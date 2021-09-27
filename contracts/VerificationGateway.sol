//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./lib/IBLS.sol"; // to use a deployed BLS library
import "./lib/IERC20.sol";

import "./BLSWallet.sol";
import "hardhat/console.sol";

import "@openzeppelin/contracts/proxy/Initializable.sol";


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

    struct TxData {
        bytes32 publicKeyHash;
        uint256 nonce;
        uint256 tokenRewardAmount;
        uint256 ethValue;
        address contractAddress;
        bytes4 methodId; //bytes4(keccak256(bytes(fnSig))
        bytes encodedParams;
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
        address rewardAddress,
        uint256[4][] calldata publicKeys,
        uint256[2] calldata signature,
        TxData[] calldata txs
    ) public {
        createNewWallets(publicKeys, txs);

        bool[] memory sends = new bool[](txs.length);
        uint256[] memory deprecatedNonces = new uint256[](txs.length);
        verifySignatures(signature, txs, deprecatedNonces, sends);

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
                bool paymentPending = txs[i].tokenRewardAmount > 0;
                if (paymentPending) {
                    // on payment success, paymentPending is false
                    paymentPending = !wallet.payTokenAmount(
                        paymentToken,
                        rewardAddress,
                        txs[i].tokenRewardAmount
                    );
                }

                if (paymentPending == false) {
                    // execute transaction (increments nonce)
                    wallet.action(
                        txs[i].ethValue,
                        txs[i].contractAddress,
                        txs[i].methodId,
                        txs[i].encodedParams
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
            txData.tokenRewardAmount,
            txData.ethValue,
            txData.contractAddress,
            keccak256(abi.encodePacked(
                txData.methodId,
                txData.encodedParams
            )),
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

    function walletCrossCheck(bytes32 hash) public payable {
        require(msg.sender == address(walletFromHash[hash]));
    }

    function blsCreateMany(
        uint256[] calldata tokenRewardAmounts,
        uint256[4][] calldata publicKeys,
        uint256[2] calldata signature
    ) external returns (bytes32[] memory hashes) {
        uint256 txCount = publicKeys.length;
        uint256[2][] memory messages = new uint256[2][](txCount);
        hashes = new bytes32[](txCount);
        bytes32 hashCreate = keccak256(abi.encode("Create BLS Wallet."));
        for(uint256 i=0; i<txCount; i++) {
            messages[i] = messagePoint(
                0,
                tokenRewardAmounts[i],
                0,
                address(this),
                hashCreate,
                false
            );
        }

        // (bool checkResult, bool callSuccess) = blsLib.verifyMultiple(
        //     signature,
        //     publicKeys,
        //     messages
        // );
        // require(callSuccess && checkResult, "VerificationGateway: All sigs not verified");

        // create wallet
        bytes32 publicKeyHash;
        for(uint256 i=0; i<txCount; i++) {
            publicKeyHash = keccak256(abi.encode(publicKeys[i]));
            require(
                address(walletFromHash[publicKeyHash]) == address(0),
                "VerificationGateway: Wallet already exists."
            );
            blsKeysFromHash[publicKeyHash] = publicKeys[i];
            walletFromHash[publicKeyHash] = new BLSWallet();
            walletFromHash[publicKeyHash].initialize(publicKeyHash);
            emit WalletCreated(
                address(walletFromHash[publicKeyHash]),
                publicKeyHash,
                publicKeys[i]
            );
            hashes[i] = publicKeyHash;
        }
    }

    function blsCallCreate(
        uint256[4] calldata publicKey,
        uint256[2] calldata signature,
        uint256 tokenRewardAmount,
        uint256 ethValue,
        address contractAddress,
        bytes4 methodId, //bytes4(keccak256(bytes(fnSig))
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
            ethValue,
            contractAddress,
            methodId,
            encodedParams
        );
    }

    function blsSend(
        bytes32 callingPublicKeyHash,
        uint256[2] calldata signature,
        uint256 tokenRewardAmount,
        uint256 ethValue,
        address payable recipient
    ) public {
        bytes32 publicKeyHash = callingPublicKeyHash;

        (bool checkResult, bool callSuccess) = blsLib.verifySingle(
            signature,
            blsKeysFromHash[publicKeyHash],
            messagePoint(
                walletFromHash[publicKeyHash].nonce(),
                tokenRewardAmount,
                ethValue,
                recipient,
                0, //NA
                true
            )
        );
        require(callSuccess && checkResult, "VerificationGateway: sig not verified with nonce+data");

        if (tokenRewardAmount > 0) {
            bool paidReward = walletFromHash[publicKeyHash].payTokenAmount(
                paymentToken,
                msg.sender,
                tokenRewardAmount
            );
            require(paidReward, "VerificationGateway: Could not pay nominated reward");
        }
        (bool sentEther, ) = walletFromHash[publicKeyHash].sendEther(
            recipient,
            ethValue
        );
    }

    function blsCall(
        bytes32 callingPublicKeyHash,
        uint256[2] calldata signature,
        uint256 tokenRewardAmount,
        uint256 ethValue,
        address contractAddress,
        bytes4 methodId, //bytes4(keccak256(bytes(fnSig))
        bytes calldata encodedParams
    ) public {
        bytes32 publicKeyHash = callingPublicKeyHash;
        // (bool callSuccess, bytes memory checkResult) = address(blsLib).call(
        //     abi.encodeWithSignature(
        //         "verifyMultiple(uint256[2],uint256[4][],uint256[2][])",
        //         signature,
        //         [blsKeysFromHash[publicKeyHash]],
        //         [messagePoint(
        //             walletFromHash[publicKeyHash].nonce(),
        //             tokenRewardAmount,
        //             ethValue,
        //             contractAddress,
        //             keccak256(abi.encodePacked(
        //                 methodId,
        //                 encodedParams
        //             )),
        //             false
        //         )]
        //     )
        // );
        (bool callSuccess, bytes memory checkResult) = address(blsLib).call(
            abi.encodeWithSignature(
                "verifySingle(uint256[2],uint256[4],uint256[2])",
                signature,
                blsKeysFromHash[publicKeyHash],
                messagePoint(
                    walletFromHash[publicKeyHash].nonce(),
                    tokenRewardAmount,
                    ethValue,
                    contractAddress,
                    keccak256(abi.encodePacked(
                        methodId,
                        encodedParams
                    )),
                    false
                )
            )
        );
        require(
            callSuccess && (uint8(checkResult[31]) != 0),
            "VerificationGateway: sig not verified with nonce+data");

        if (tokenRewardAmount > 0) {
            bool success = walletFromHash[publicKeyHash].payTokenAmount(
                paymentToken,
                msg.sender,
                tokenRewardAmount
            );
            require(success, "VerificationGateway: Could not pay nominated reward");
        }
        bool result = walletFromHash[publicKeyHash].action(
            ethValue,
            contractAddress,
            methodId,
            encodedParams
        );
    }

    /**
    @param txs array of transaction data
    @return nonces an array of corresponding nonces from the current wallet nonce
    */
    function noncesForTxs(
        TxData[] calldata txs
    ) internal view returns (
        uint256[] memory nonces
    ) {
        nonces = new uint256[](txs.length);
        nonces[0] = walletFromHash[txs[0].publicKeyHash].nonce();
        for (uint32 i=1; i<txs.length; i++) {
            // start with nonce from wallet's nonce
            nonces[i] = walletFromHash[txs[i].publicKeyHash].nonce();
            // check past txs in reverse order for previous tx from wallet
            uint32 pastIndex = i;
            do {
                pastIndex--;
                // if the address matches, the nonce is one more than the previous
                if (txs[i].publicKeyHash == txs[pastIndex].publicKeyHash) {
                    nonces[i] = nonces[pastIndex] + 1;
                    break;
                }
            } while(pastIndex != 0);
        }
    }

    /**
    Requires wallet contracts to exist.
    @param signature aggregated signature
    @param txs transaction data to be processed
    @param txNonces wallet nonce per tx in txs
    */
    function verifySignatures(
        uint256[2] calldata signature,
        TxData[] calldata txs,
        uint256[] memory txNonces,
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
                txs[i].tokenRewardAmount,
                txs[i].ethValue,
                txs[i].contractAddress,
                keccak256(abi.encodePacked(
                    txs[i].methodId,
                    txs[i].encodedParams
                )),
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

    /**
    @dev Assumes multiple txs from the same wallet appear in order
    of ascending nonce. Wallet txs do not have to be consecutive. 
     */
    function blsCallMany(
        address rewardAddress,
        uint256[2] calldata signature,
        TxData[] calldata txs
    ) external {
        // uint256 txCount = txs.length;
        // uint256[BLS_LEN][] memory publicKeys = new uint256[BLS_LEN][](txCount);
        // uint256[2][] memory messages = new uint256[2][](txCount);
        BLSWallet wallet;

        uint256[] memory txNonces = noncesForTxs(txs);
        bool[] memory sends = new bool[](txs.length);
        // verifySignatures(signature, txs, txNonces, sends);

        // attempt payment and actions
        for (uint256 i = 0; i<txs.length; i++) {
            // construct params for signature verification
            // publicKeys[i] = blsKeysFromHash[txs[i].publicKeyHash];
            wallet = walletFromHash[txs[i].publicKeyHash];

            // if the wallet nonce for the tx matches the current wallet's nonce,
            // action the transaction after payment. This won't be the case if 
            // a previous tx in txs for the wallet has failed to pay.
            if (txNonces[i] == wallet.nonce()) {
                bool paymentPending = txs[i].tokenRewardAmount > 0;
                if (paymentPending) {
                    // on payment success, paymentPending is false
                    paymentPending = !wallet.payTokenAmount(
                        paymentToken,
                        rewardAddress,
                        txs[i].tokenRewardAmount
                    );
                }

                if (paymentPending == false) {
                    // execute transaction (increments nonce)
                    wallet.action(
                        txs[i].ethValue,
                        txs[i].contractAddress,
                        txs[i].methodId,
                        txs[i].encodedParams
                    );
                }
            }
        }

        // (bool checkResult, bool callSuccess) = blsLib.verifyMultiple(
        //     signature,
        //     publicKeys,
        //     messages
        // );
        // // revert everything if signatures not satisfied
        // require(callSuccess && checkResult, "VerificationGateway: All sigs not verified");
    }

    bytes32 immutable SEND_ONLY = 0x53454e445f4f4e4c590000000000000000000000000000000000000000000000;
    function messagePoint(
        uint256 nonce,
        uint256 tokenRewardAmount,
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
                tokenRewardAmount,
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