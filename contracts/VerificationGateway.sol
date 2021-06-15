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
        uint256[4] calldata publicKey,
        uint256[2] calldata signature,
        uint256 tokenRewardAmount,
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
            publicKeyHash,
            signature,
            tokenRewardAmount,
            contractAddress,
            methodID,
            encodedParams
        );
    }

    function blsCall(
        bytes32 callingPublicKeyHash,
        uint256[2] calldata signature,
        uint256 tokenRewardAmount,
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
                tokenRewardAmount,
                contractAddress,
                keccak256(abi.encodePacked(
                    methodID,
                    encodedParams
                ))
            )
        );
        require(callSuccess && checkResult, "VerificationGateway: sig not verified with nonce+data");

        if (tokenRewardAmount > 0) {
            walletFromHash[publicKeyHash].payTokenAmount(
                paymentToken,
                msg.sender,
                tokenRewardAmount
            );
        }

        walletFromHash[publicKeyHash].action(
            contractAddress,
            methodID,
            encodedParams
        );
    }

    struct TxData {
        bytes32 publicKeyHash;
        uint256 tokenRewardAmount;
        address contractAddress;
        bytes4 methodID;
        bytes encodedParams;
    }

    /**
    @dev Assumes multiple txs from the same wallet appear in order
    of ascending nonce. Wallet txs do not have to be consecutive. 
     */
    function blsCallMany(
        address rewardAddress,
        uint256[2] calldata signature,
        TxData[] calldata txs
    ) external {
        uint256 txCount = txs.length;
        uint256[BLS_LEN][] memory publicKeys = new uint256[BLS_LEN][](txCount);
        uint256[2][] memory messages = new uint256[2][](txCount);
        BLSWallet wallet;

        for (uint256 i = 0; i<txCount; i++) {
            // // construct params for signature verification
            publicKeys[i] = blsKeysFromHash[txs[i].publicKeyHash];
            wallet = walletFromHash[txs[i].publicKeyHash];
            messages[i] = messagePoint(
                wallet.nonce(),
                txs[i].tokenRewardAmount,
                txs[i].contractAddress,
                keccak256(abi.encodePacked(
                    txs[i].methodID,
                    txs[i].encodedParams
                ))
            );

            if (txs[i].tokenRewardAmount > 0) {
                wallet.payTokenAmount(
                    paymentToken,
                    rewardAddress,
                    txs[i].tokenRewardAmount
                );
            }

            // execute transaction (increments nonce), will revert if all signatures not satisfied
            wallet.action(
                txs[i].contractAddress,
                txs[i].methodID,
                txs[i].encodedParams
            );
        }

        (bool checkResult, bool callSuccess) = BLS.verifyMultiple(
            signature,
            publicKeys,
            messages
        );
        require(callSuccess && checkResult, "VerificationGateway: All sigs not verified");
    }

    function messagePoint(
        uint256 nonce,
        uint256 tokenRewardAmount,
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
                tokenRewardAmount,
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