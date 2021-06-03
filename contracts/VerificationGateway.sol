//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;
// pragma abicoder v2;
pragma experimental ABIEncoderV2;

// Modified for solidity 0.7.0
import "./lib/BLS.sol"; //from hubble repo
import "./lib/IERC20.sol";

import "./BLSWallet.sol";
// import "hardhat/console.sol";

import "@openzeppelin/contracts/proxy/Initializable.sol";

/**
@dev Optimisations to reduce calldata of VerificationGateway multiCall
with shared params.
*/
contract BLSExpander is Initializable {
    VerificationGateway verificationGateway;
    function initialize(address gateway) public initializer {
        verificationGateway = VerificationGateway(gateway);
    }

    // eg approve and transfers of a token contract
    function blsCallMultiSameContract(
        bytes32[] calldata  publicKeyHashes,
        uint256[2] memory signature,
        address contractAddress,
        bytes4[] calldata methodIDs,
        bytes[] calldata encodedParamSets
    ) public {
        uint256 length = publicKeyHashes.length;
        address[] memory contractAddresses = new address[](length);
        for (uint256 i=0; i<length; i++) {
            contractAddresses[i] = contractAddress;
        }

        verificationGateway.blsCallMany(
            publicKeyHashes,
            signature,
            contractAddresses,
            methodIDs,
            encodedParamSets
        );
    }

    // eg a set of txs from one account
    function blsCallMultiSameCaller(
        bytes32 publicKeyHash,
        uint256[2] memory signature,
        address[] calldata contractAddresses,
        bytes4[] calldata methodIDs,
        bytes[] calldata encodedParamSets
    ) public {
        uint256 length = contractAddresses.length;
        bytes32[] memory publicKeyHashes = new bytes32[](length);
        for (uint256 i=0; i<length; i++) {
            publicKeyHashes[i] = publicKeyHash;
        }

        verificationGateway.blsCallMany(
            publicKeyHashes,
            signature,
            contractAddresses,
            methodIDs,
            encodedParamSets
        );
    }

    // eg airdrop
    function blsCallMultiSameCallerContractFunction(
        bytes32  publicKeyHash,
        uint256[2] memory signature,
        address contractAddress,
        bytes4 methodID,
        bytes[] calldata encodedParamSets
    ) public {
        uint256 length = encodedParamSets.length;
        bytes32[] memory publicKeyHashes = new bytes32[](length);
        address[] memory contractAddresses = new address[](length);
        bytes4[] memory methodIDs = new bytes4[](length);
        for (uint256 i=0; i<length; i++) {
            contractAddresses[i] = contractAddress;
            methodIDs[i] = methodID;
            publicKeyHashes[i] = publicKeyHash;
        }

        verificationGateway.blsCallMany(
            publicKeyHashes,
            signature,
            contractAddresses,
            methodIDs,
            encodedParamSets
        );
    }

    // eg identical txs from multiple accounts
    function blsCallMultiSameContractFunctionParams(
        bytes32[] calldata  publicKeyHashes,
        uint256[2] memory signature,
        address contractAddress,
        bytes4 methodID,
        bytes calldata encodedParams
    ) public {
        uint256 length = publicKeyHashes.length;
        address[] memory contractAddresses = new address[](length);
        bytes4[] memory methodIDs = new bytes4[](length);
        bytes[] memory encodedParamSets = new bytes[](length);
        for (uint256 i=0; i<length; i++) {
            contractAddresses[i] = contractAddress;
            methodIDs[i] = methodID;
            encodedParamSets[i] = encodedParams;
        }

        verificationGateway.blsCallMany(
            publicKeyHashes,
            signature,
            contractAddresses,
            methodIDs,
            encodedParamSets
        );
    }

}

contract VerificationGateway
{
    bytes32 BLS_DOMAIN = keccak256(abi.encodePacked(uint32(0xfeedbee5)));
    uint256 constant BLS_LEN = 4;
    // uint256[BLS_LEN] ZERO_BLS_SIG = [uint256(0), uint256(0), uint256(0), uint256(0)];

    mapping (bytes32 => uint256[BLS_LEN]) blsKeysFromHash;
    mapping (bytes32 => BLSWallet) public walletFromHash;

    event WalletCreated(
        address indexed wallet,
        bytes32 indexed publicKeyHash,
        uint256[BLS_LEN] publicKey
    );

    function walletCrossCheck(bytes32 hash) public view {
        require(msg.sender == address(walletFromHash[hash]));
    }

    /**
    @dev Local variables to avoid stack limit in functions. 
     */
    uint256 txCount;
    bytes32 publicKeyHash;
    BLSWallet wallet;
    function clearLocals() private {
        txCount = 0;
        publicKeyHash = 0;
        wallet = BLSWallet(0);
    }
    modifier usesLocals() {
        _;
        clearLocals();
    }

    function blsCallCreate(
        uint256[4] calldata publicKey,
        uint256[2] calldata signature,
        address contractAddress,
        bytes4 methodID, //bytes4(keccak256(bytes(fnSig))
        bytes calldata encodedParams
    ) public usesLocals {
        publicKeyHash = keccak256(abi.encodePacked(publicKey));
        require(
            address(walletFromHash[publicKeyHash]) == address(0),
            "VerificationGateway: Wallet already exists."
        );
        blsKeysFromHash[publicKeyHash] = publicKey;
        walletFromHash[publicKeyHash] = new BLSWallet();
        walletFromHash[publicKeyHash].initialize(publicKeyHash);
        emit WalletCreated(
            address(walletFromHash[publicKeyHash]),
            publicKeyHash,
            publicKey
        );

        /// @dev Signature verification of given public key.
        blsCall(
            publicKeyHash,
            signature,
            contractAddress,
            methodID,
            encodedParams
        );
    }

    function blsCall(
        bytes32 callingPublicKeyHash,
        uint256[2] calldata signature,
        address contractAddress,
        bytes4 methodID, //bytes4(keccak256(bytes(fnSig))
        bytes calldata encodedParams
    ) public usesLocals {
        publicKeyHash = callingPublicKeyHash;
        wallet = walletFromHash[publicKeyHash];

        (bool checkResult, bool callSuccess) = BLS.verifySingle(
            signature,
            blsKeysFromHash[publicKeyHash],
            messagePoint(
                wallet.nonce(),
                contractAddress,
                keccak256(abi.encodePacked(
                    methodID,
                    encodedParams
                ))
            )
        );
        require(callSuccess && checkResult, "VerificationGateway: sig not verified with nonce+data");

        wallet.action(
            contractAddress,
            methodID,
            encodedParams
        );
    }

    /**
    @dev Assumes multiple txs from the same wallet appear in order
    of ascending nonce. Wallet txs do not have to be consecutive. 
     */
    function blsCallMany(
        bytes32[] calldata  publicKeyHashes,
        uint256[2] memory signature,
        address[] calldata contractAddresses,
        bytes4[] calldata methodIDs,
        bytes[] calldata encodedParamSets
    ) public usesLocals {
        txCount = contractAddresses.length;
        require(methodIDs.length == txCount, "VerificationGateway: methodIDs/contracts length mismatch.");
        require(encodedParamSets.length == txCount, "VerificationGateway: encodedParamSets/contracts length mismatch.");
        require(publicKeyHashes.length == txCount, "VerificationGateway: publicKeyHash/contracts length mismatch.");
        uint256[BLS_LEN][] memory publicKeys = new uint256[BLS_LEN][](txCount);
        uint256[2][] memory messages = new uint256[2][](txCount);
        for (uint256 i = 0; i<txCount; i++) {
            // construct params for signature verification
            publicKeyHash = publicKeyHashes[i];
            publicKeys[i] = blsKeysFromHash[publicKeyHash];
            wallet = walletFromHash[publicKeyHash];
            messages[i] = messagePoint(
                wallet.nonce(),
                contractAddresses[i],
                keccak256(abi.encodePacked(
                    methodIDs[i],
                    encodedParamSets[i]
                ))
            );

            // execute transaction (increments nonce), will revert if all signatures not satisfied
            walletFromHash[publicKeyHashes[i]].action(
                contractAddresses[i],
                methodIDs[i],
                encodedParamSets[i]
            );

        }
        (bool checkResult, bool callSuccess) = BLS.verifyMultiple(signature, publicKeys, messages);
        require(callSuccess && checkResult, "VerificationGateway: All sigs not verified");
    }

    function messagePoint(
        uint256 nonce,
        address contractAddress,
        bytes32 encodedFunctionHash
    ) internal view returns (uint256[2] memory) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return BLS.hashToPoint(
            BLS_DOMAIN,
            abi.encodePacked(
                chainId, //block.chainid,
                nonce,
                contractAddress,
                encodedFunctionHash
            )
        );
    }

    function pointsMatch(
        uint256[2] calldata a,
        uint256[2] memory b
    ) internal pure returns (bool result) {
        result = (a[0] == b[0]);
        result = result && (a[1] == b[1]);
    }

}