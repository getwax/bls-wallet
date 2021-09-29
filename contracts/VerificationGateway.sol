//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;

import "./lib/IBLS.sol"; // to use a deployed BLS library
import "./lib/IERC20.sol";

import "./BLSWallet.sol";
import "hardhat/console.sol";

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";


contract VerificationGateway is Initializable
{
    bytes32 BLS_DOMAIN = keccak256(abi.encodePacked(uint32(0xfeedbee5)));
    uint256 constant BLS_LEN = 4;
    // uint256[BLS_LEN] ZERO_BLS_SIG = [uint256(0), uint256(0), uint256(0), uint256(0)];

    mapping (bytes32 => uint256[BLS_LEN]) blsKeysFromHash;
    mapping (bytes32 => BLSWallet) public walletFromHash;

    IERC20 public paymentToken;
    IBLS blsLib;

    /**
    @param bls verified bls library contract address
    @param token default payment token
     */
    function initialize(IBLS bls, IERC20 token) public initializer {
        blsLib = bls;
        paymentToken = token;
    }

    event WalletCreated(
        address indexed wallet,
        bytes32 indexed publicKeyHash,
        uint256[BLS_LEN] publicKey
    );

    event WalletActioned(
        address indexed wallet,
        uint256 nonce,
        bool result
    );

    struct TxData {
        bytes32 publicKeyHash;
        uint256 nonce;
        IERC20 rewardTokenAddress;
        uint256 rewardTokenAmount;
        uint256 ethValue;
        address contractAddress;
        bytes encodedFunction;
    }

    function checkSig(
        uint256 signedNonce,
        TxData calldata txData,
        uint256[2] calldata signature,
        bool sendOnly
    ) external view
    returns (
        bool result,
        uint256 nextNonce
    ) {
        uint256[2] memory msgPoint = messagePoint(
            signedNonce,
            txData.rewardTokenAddress,
            txData.rewardTokenAmount,
            txData.ethValue,
            txData.contractAddress,
            keccak256(txData.encodedFunction),
            sendOnly
        );
        (bool checkResult, bool callSuccess) = blsLib.verifySingle(
            signature,
            blsKeysFromHash[txData.publicKeyHash],
            msgPoint
        );
        
        result = callSuccess && checkResult;
        nextNonce = walletFromHash[txData.publicKeyHash].nonce();
    }

    function blsSend(
        address payable rewardRecipient,
        bytes32 callingPublicKeyHash,
        uint256[2] calldata signature,
        IERC20 rewardTokenAddress,
        uint256 rewardTokenAmount,
        uint256 ethValue,
        address payable recipient
    ) public {
        bytes32 publicKeyHash = callingPublicKeyHash;

        (bool checkResult, bool callSuccess) = blsLib.verifySingle(
            signature,
            blsKeysFromHash[publicKeyHash],
            messagePoint(
                walletFromHash[publicKeyHash].nonce(),
                rewardTokenAddress,
                rewardTokenAmount,
                ethValue,
                recipient,
                0, //NA
                true
            )
        );
        require(callSuccess && checkResult, "VerificationGateway: sig not verified with nonce+data");

        if (rewardTokenAmount > 0) {
            bool paidReward = walletFromHash[publicKeyHash].payTokenAmount(
                rewardTokenAddress,
                rewardRecipient,
                rewardTokenAmount
            );
            require(paidReward, "VerificationGateway: Could not pay nominated reward");
        }
        (bool sentEther, ) = walletFromHash[publicKeyHash].sendEther(
            recipient,
            ethValue
        );
    }

    /**
    Requires wallet contracts to exist.
    @param signature aggregated signature
    @param txs transaction data to be processed
    @param sendOnlys whether the transaction was explicitly just the sending of ETH
    */
    function verifySignatures(
        uint256[2] calldata signature,
        TxData[] calldata txs,
        bool[] memory sendOnlys
    ) public view {
        uint256 txCount = txs.length;
        uint256[BLS_LEN][] memory publicKeys = new uint256[BLS_LEN][](txCount);
        uint256[2][] memory messages = new uint256[2][](txCount);

        for (uint256 i = 0; i<txCount; i++) {
            // construct params for signature verification
            publicKeys[i] = blsKeysFromHash[txs[i].publicKeyHash];
            messages[i] = messagePoint(
                txs[i].nonce,
                txs[i].rewardTokenAddress,
                txs[i].rewardTokenAmount,
                txs[i].ethValue,
                txs[i].contractAddress,
                keccak256(txs[i].encodedFunction),
                sendOnlys[i]
            );
        }

        bool verified = blsLib.verifyMultiple(
            signature,
            publicKeys,
            messages
        );

        require(verified, "VerificationGateway: All sigs not verified");
    }

    function walletCrossCheck(bytes32 hash) public payable {
        require(msg.sender == address(walletFromHash[hash]));
    }

    /** 
    Base function for verifying and actioning BLS-signed transactions.
    Creates a new bls wallet if a transaction's first time.
    Can be called with a single transaction.
    @param publicKeys the public bls key for first-time transactions, can be 0
    @param signature aggregated bls signature of all transactions
    @param txs data required for a BLSWallet to make a transaction
    */
    function actionCalls(
        address payable rewardRecipient,
        uint256[4][] calldata publicKeys,
        uint256[2] calldata signature,
        TxData[] calldata txs
    ) public {
        createNewWallets(publicKeys, txs);

        bool[] memory sends = new bool[](txs.length);
        verifySignatures(signature, txs, sends);

        BLSWallet wallet;
        // attempt payment and actions
        for (uint256 i = 0; i<txs.length; i++) {
            // construct params for signature verification
            // publicKeys[i] = blsKeysFromHash[txs[i].publicKeyHash];
            wallet = walletFromHash[txs[i].publicKeyHash];

            // if the wallet nonce for the tx matches the current wallet's nonce,
            // action the transaction after payment. This won't be the case if 
            // a previous tx in txs for the wallet has failed to pay.
            if (txs[i].nonce == wallet.nonce()) {
                bool paymentPending = txs[i].rewardTokenAmount > 0;
                if (paymentPending) {
                    // on payment success, paymentPending is false
                    paymentPending = !wallet.payTokenAmount(
                        txs[i].rewardTokenAddress,
                        rewardRecipient,
                        txs[i].rewardTokenAmount
                    );
                }

                if (paymentPending == false) {
                    // execute transaction (increments nonce)
                    bool success = wallet.action(
                        txs[i].ethValue,
                        txs[i].contractAddress,
                        txs[i].encodedFunction
                    );
                    emit WalletActioned(
                        address(wallet),
                        wallet.nonce(),
                        success
                    );
                }
            }
        }
    }

    /**
    Create a new wallet if one doesn't exist for the given bls key hash and public key.
    @param publicKeys a public key can be 0 if the hash (and wallet) exist
    @param txs contains public key hashes that should equal the corresponding public key if given.
     */
    function createNewWallets(
        uint256[4][] calldata publicKeys,
        TxData[] calldata txs
    ) internal {
        for (uint i=0; i<txs.length; i++) {
            bytes32 publicKeyHash = txs[i].publicKeyHash;
            // publicKeyHash corresponds to given public key (false if 0)
            // and wallet at publicKeyHash doesn't exist
            if (
                (publicKeyHash == keccak256(abi.encodePacked(publicKeys[i]))) &&
                (address(walletFromHash[txs[i].publicKeyHash]) == address(0))
            ) {
                blsKeysFromHash[publicKeyHash] = publicKeys[i];
                walletFromHash[publicKeyHash] = new BLSWallet();
                walletFromHash[publicKeyHash].initialize(publicKeyHash);
                emit WalletCreated(
                    address(walletFromHash[publicKeyHash]),
                    publicKeyHash,
                    publicKeys[i]
                );
            }
        }
    }


    bytes32 immutable SEND_ONLY = 0x53454e445f4f4e4c590000000000000000000000000000000000000000000000;
    function messagePoint(
        uint256 nonce,
        IERC20 rewardTokenAddress,
        uint256 rewardTokenAmount,
        uint256 ethValue,
        address contractAddress,
        bytes32 encodedFunctionHash,
        bool sendOnly
    ) internal view returns (uint256[2] memory) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return blsLib.hashToPoint(
            BLS_DOMAIN,
            abi.encodePacked(
                chainId, //block.chainid,
                nonce,
                rewardTokenAddress,
                rewardTokenAmount,
                ethValue,
                contractAddress,
                sendOnly ? SEND_ONLY : encodedFunctionHash
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