//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;
// pragma abicoder v2;
pragma experimental ABIEncoderV2;

// Modified for solidity 0.7.0
import "./lib/BLS.sol"; //from hubble repo
import "./lib/IERC20.sol";

import "hardhat/console.sol";

interface IVerificationGateway {
    function walletCrossCheck(bytes32 publicKeyHash) external;
}

/** @dev TODO (WIP): protect from replay (nonce, chainId).
 */
contract BLSWalletProxy
{
    address admin;
    bytes32 public publicKeyHash;

    constructor(bytes32 blsKeyHash) {
        publicKeyHash = blsKeyHash;
        admin = msg.sender;
    }

    function registerGateway(
        address verificationGateway
    ) internal {
        IVerificationGateway(verificationGateway).walletCrossCheck(publicKeyHash);
    }

    function action(
        address contractAddress,
        bytes4 methodID,
        bytes memory encodedParams
    ) public onlyAdmin returns (bool success) {
        bytes memory encodedFunction = abi.encodePacked(methodID, encodedParams);

        (success, ) = address(contractAddress).call(encodedFunction);
        require(success, "BLSWalletProxy: action failed to call encodedFunction");
    }


    //TODO: reset admin (via bls key)

    //TODO: social recovery

    modifier onlyAdmin() {
        require(msg.sender == admin);
        _;
    }
}

/**
@dev Optimisations to reduce calldata of VerificationGateway multiCall
with shared params.
*/
contract BLSExpander {
    VerificationGateway verificationGateway;
    constructor(address gateway) {
        verificationGateway = VerificationGateway(gateway);
    }

    // eg approve and transfers of a token contract
    function blsCallMultiSameContract(
        uint256[2] memory signature,
        address contractAddress,
        bytes4[] calldata methodIDs,
        bytes[] calldata encodedParamSets,
        bytes32[] calldata  publicKeyHashes
    ) public {
        uint256 length = methodIDs.length;
        address[] memory contractAddresses = new address[](length);
        for (uint256 i=0; i<length; i++) {
            contractAddresses[i] = contractAddress;
        }

        verificationGateway.blsCallMany(
            signature,
            contractAddresses,
            methodIDs,
            encodedParamSets,
            publicKeyHashes
        );
    }

    // eg a set of txs from one account
    function blsCallMultiSameCaller(
        uint256[2] memory signature,
        address[] calldata contractAddresses,
        bytes4[] calldata methodIDs,
        bytes[] calldata encodedParamSets,
        bytes32 publicKeyHash
    ) public {
        uint256 length = contractAddresses.length;
        bytes32[] memory publicKeyHashes = new bytes32[](length);
        for (uint256 i=0; i<length; i++) {
            publicKeyHashes[i] = publicKeyHash;
        }

        verificationGateway.blsCallMany(
            signature,
            contractAddresses,
            methodIDs,
            encodedParamSets,
            publicKeyHashes
        );
    }

    // eg airdrop
    function blsCallMultiSameCallerContractFunction(
        uint256[2] memory signature,
        address contractAddress,
        bytes4 methodID,
        bytes[] calldata encodedParamSets,
        bytes32  publicKeyHash
    ) public {
        uint256 length = encodedParamSets.length;
        address[] memory contractAddresses = new address[](length);
        bytes4[] memory methodIDs = new bytes4[](length);
        bytes32[] memory publicKeyHashes = new bytes32[](length);
        for (uint256 i=0; i<length; i++) {
            contractAddresses[i] = contractAddress;
            methodIDs[i] = methodID;
            publicKeyHashes[i] = publicKeyHash;
        }

        verificationGateway.blsCallMany(
            signature,
            contractAddresses,
            methodIDs,
            encodedParamSets,
            publicKeyHashes
        );
    }

    // eg identical txs from multiple accounts
    function blsCallMultiSameContractFunctionParams(
        uint256[2] memory signature,
        address contractAddress,
        bytes4 methodID,
        bytes calldata encodedParams,
        bytes32[] calldata  publicKeyHashes
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
            signature,
            contractAddresses,
            methodIDs,
            encodedParamSets,
            publicKeyHashes
        );
    }

}

contract VerificationGateway
{
    bytes32 BLS_DOMAIN = keccak256(abi.encodePacked(uint32(0xfeedbee5)));
    uint256 constant BLS_LEN = 4;
    // uint256[BLS_LEN] ZERO_BLS_SIG = [uint256(0), uint256(0), uint256(0), uint256(0)];

    mapping (bytes32 => uint256[BLS_LEN]) blsKeysFromHash;
    mapping (bytes32 => BLSWalletProxy) public walletFromHash;

    event WalletCreated(
        address indexed wallet,
        bytes32 indexed publicKeyHash,
        uint256[BLS_LEN] publicKey
    );

    //TODO?
    // event ActionPerformed(
    //     address indexed wallet,
    //     bytes32 indexed publicKeyHash,
    //     address contract
    // );

    function walletCrossCheck(bytes32 hash) public {
        require(msg.sender == address(walletFromHash[hash]));
    }

    function blsCallCreate(
        uint256[2] calldata signature,
        address contractAddress,
        bytes4 methodID, //bytes4(keccak256(bytes(fnSig))
        bytes calldata encodedParams,
        uint256[4] calldata publicKey
    ) public {
        bytes32 publicKeyHash = keccak256(abi.encodePacked(publicKey));
        if (address(walletFromHash[publicKeyHash]) == address(0)) {
            blsKeysFromHash[publicKeyHash] = publicKey;
            walletFromHash[publicKeyHash] = new BLSWalletProxy(publicKeyHash);
            emit WalletCreated(
                address(walletFromHash[publicKeyHash]),
                publicKeyHash,
                publicKey
            );
        }

        blsCall(
            signature,
            contractAddress,
            methodID,
            encodedParams,
            publicKeyHash
        );
    }

    function blsCall(
        uint256[2] calldata signature,
        address contractAddress,
        bytes4 methodID, //bytes4(keccak256(bytes(fnSig))
        bytes calldata encodedParams,
        bytes32 publicKeyHash
    ) public {
        bytes32 fnHash = keccak256(abi.encodePacked(
            methodID,
            encodedParams
        ));

        (bool checkResult, bool callSuccess) = BLS.verifySingle(
            signature,
            blsKeysFromHash[publicKeyHash],
            messagePoint(
                contractAddress,
                keccak256(abi.encodePacked(
                    methodID,
                    encodedParams
                ))
            )
        );
        require(callSuccess && checkResult, "VerificationGateway: sig not verified");
        bytes memory encodedFunction = abi.encodePacked(methodID, encodedParams);

        walletFromHash[publicKeyHash].action(
            contractAddress,
            methodID,
            encodedParams
        );
    }

    function blsCallMany(
        uint256[2] memory signature,
        address[] calldata contractAddresses,
        bytes4[] calldata methodIDs,
        bytes[] calldata encodedParamSets,
        bytes32[] calldata  publicKeyHashes
    ) public {
        uint256 txCount = contractAddresses.length;
        require(methodIDs.length == txCount, "VerificationGateway: methodIDs/contracts length mismatch.");
        require(encodedParamSets.length == txCount, "VerificationGateway: encodedParamSets/contracts length mismatch.");
        require(publicKeyHashes.length == txCount, "VerificationGateway: publicKeyHash/contracts length mismatch.");
        
        uint256[BLS_LEN][] memory publicKeys = new uint256[BLS_LEN][](txCount);
        uint256[2][] memory messages = new uint256[2][](txCount);
        for (uint256 i = 0; i<txCount; i++) {
            publicKeys[i] = blsKeysFromHash[publicKeyHashes[i]];
            messages[i] = messagePoint(
                contractAddresses[i],
                keccak256(abi.encodePacked(
                    methodIDs[i],
                    encodedParamSets[i]
                ))
            );
        }
        (bool checkResult, bool callSuccess) = BLS.verifyMultiple(signature, publicKeys, messages);
        require(callSuccess && checkResult, "VerificationGateway: All sigs not verified");

        for (uint256 i = 0; i<txCount; i++) {
            walletFromHash[publicKeyHashes[i]].action(
                contractAddresses[i],
                methodIDs[i],
                encodedParamSets[i]
            );
        }
    }

    function messagePoint(
        address contractAddress,
        bytes32 encodedFunctionHash
    ) internal view returns (uint256[2] memory) {
        return BLS.hashToPoint(
            BLS_DOMAIN,
            abi.encodePacked(
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