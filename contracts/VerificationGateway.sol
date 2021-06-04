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


contract VerificationGateway is Initializable
{
    bytes32 BLS_DOMAIN = keccak256(abi.encodePacked(uint32(0xfeedbee5)));
    uint256 constant BLS_LEN = 4;
    // uint256[BLS_LEN] ZERO_BLS_SIG = [uint256(0), uint256(0), uint256(0), uint256(0)];

    mapping (bytes32 => uint256[BLS_LEN]) blsKeysFromHash;
    mapping (bytes32 => BLSWallet) public walletFromHash;

    IERC20 paymentToken;

    function initialize(IERC20 token) public initializer {
        paymentToken = token;
    }

    event WalletCreated(
        address indexed wallet,
        bytes32 indexed publicKeyHash,
        uint256[BLS_LEN] publicKey
    );

    function walletCrossCheck(bytes32 hash) public view {
        require(msg.sender == address(walletFromHash[hash]));
    }

    function blsCallCreate(
        uint256 tokenRewardAmount,
        uint256[4] calldata publicKey,
        uint256[2] calldata signature,
        address contractAddress,
        bytes4 methodID, //bytes4(keccak256(bytes(fnSig))
        bytes calldata encodedParams
    ) public {
        bytes32 publicKeyHash = keccak256(abi.encodePacked(publicKey));
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
            tokenRewardAmount,
            publicKeyHash,
            signature,
            contractAddress,
            methodID,
            encodedParams
        );
    }

    function blsCall(
        uint256 tokenRewardAmount,
        bytes32 callingPublicKeyHash,
        uint256[2] calldata signature,
        address contractAddress,
        bytes4 methodID, //bytes4(keccak256(bytes(fnSig))
        bytes calldata encodedParams
    ) public {
        bytes32 publicKeyHash = callingPublicKeyHash;

        (bool checkResult, bool callSuccess) = BLS.verifySingle(
            signature,
            blsKeysFromHash[publicKeyHash],
            messagePoint(
                walletFromHash[publicKeyHash].nonce(),
                contractAddress,
                keccak256(abi.encodePacked(
                    methodID,
                    encodedParams
                ))
            )
        );
        require(callSuccess && checkResult, "VerificationGateway: sig not verified with nonce+data");

        walletFromHash[publicKeyHash].action(
            contractAddress,
            methodID,
            encodedParams
        );
    }

    /**
    @dev Local variables to avoid stack limit in function with many local variables.
     */
    uint256 txCount_tmp;
    bytes32 publicKeyHash_tmp;
    BLSWallet wallet_tmp;
    uint256[BLS_LEN][] publicKeys_tmp;
    uint256[2][] messages_tmp;
    function clearLocals() private {
        txCount_tmp = 0;
        publicKeyHash_tmp = 0;
        wallet_tmp = BLSWallet(0);
        delete publicKeys_tmp;
        delete messages_tmp;
    }
    modifier usesLocals() {
        _;
        clearLocals();
    }

    /**
    @dev Assumes multiple txs from the same wallet appear in order
    of ascending nonce. Wallet txs do not have to be consecutive. 
     */
    function blsCallMany(
        uint256[] calldata tokenRewardAmounts,
        bytes32[] calldata  publicKeyHashes,
        uint256[2] memory signature,
        address[] calldata contractAddresses,
        bytes4[] calldata methodIDs,
        bytes[] calldata encodedParamSets
    ) public usesLocals {
        txCount_tmp = contractAddresses.length;
        require(tokenRewardAmounts.length == txCount_tmp, "VerificationGateway: tokenRewardAmounts/contracts length mismatch.");
        require(methodIDs.length == txCount_tmp, "VerificationGateway: methodIDs/contracts length mismatch.");
        require(encodedParamSets.length == txCount_tmp, "VerificationGateway: encodedParamSets/contracts length mismatch.");
        require(publicKeyHashes.length == txCount_tmp, "VerificationGateway: publicKeyHash/contracts length mismatch.");
        publicKeys_tmp = new uint256[BLS_LEN][](txCount_tmp);
        messages_tmp = new uint256[2][](txCount_tmp);

        for (uint256 i = 0; i<txCount_tmp; i++) {
            // // construct params for signature verification
            publicKeyHash_tmp = publicKeyHashes[i];
            publicKeys_tmp[i] = blsKeysFromHash[publicKeyHash_tmp];
            wallet_tmp = walletFromHash[publicKeyHash_tmp];
            messages_tmp[i] = messagePoint(
                wallet_tmp.nonce(),
                contractAddresses[i],
                keccak256(abi.encodePacked(
                    methodIDs[i],
                    encodedParamSets[i]
                ))
            );

            if (tokenRewardAmounts[i] > 0) {
                wallet_tmp.payTokenAmount(
                    paymentToken,
                    msg.sender,
                    tokenRewardAmounts[i]
                );
            }
            
            // execute transaction (increments nonce), will revert if all signatures not satisfied
            wallet_tmp.action(
                contractAddresses[i],
                methodIDs[i],
                encodedParamSets[i]
            );

        }
        (bool checkResult, bool callSuccess) = BLS.verifyMultiple(
            signature,
            publicKeys_tmp,
            messages_tmp
        );
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