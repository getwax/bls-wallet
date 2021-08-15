//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

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

    IERC20 public paymentToken;

    function initialize(IERC20 token) public initializer {
        paymentToken = token;
    }

    event WalletCreated(
        address indexed wallet,
        bytes32 indexed publicKeyHash,
        uint256[BLS_LEN] publicKey
    );

    struct TxData {
        bytes32 publicKeyHash;
        uint256 tokenRewardAmount;
        address contractAddress;
        bytes4 methodId; //bytes4(keccak256(bytes(fnSig))
        bytes encodedParams;
    }
    function checkSig(
        uint256 signedNonce,
        TxData calldata txData,
        uint256[2] calldata signature
    ) external view
    returns (
        bool result,
        uint256 nextNonce
    ) {
        (bool checkResult, bool callSuccess) = BLS.verifySingle(
            signature,
            blsKeysFromHash[txData.publicKeyHash],
            messagePoint(
                signedNonce,
                txData.tokenRewardAmount,
                txData.contractAddress,
                keccak256(abi.encodePacked(
                    txData.methodId,
                    txData.encodedParams
                ))
            )
        );
        
        result = callSuccess && checkResult;
        nextNonce = walletFromHash[txData.publicKeyHash].nonce();
    }

    function walletCrossCheck(bytes32 hash) public view {
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
                address(this),
                hashCreate
            );
        }

        (bool checkResult, bool callSuccess) = BLS.verifyMultiple(
            signature,
            publicKeys,
            messages
        );
        require(callSuccess && checkResult, "VerificationGateway: All sigs not verified");

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
            contractAddress,
            methodId,
            encodedParams
        );
    }

    function blsCall(
        bytes32 callingPublicKeyHash,
        uint256[2] calldata signature,
        uint256 tokenRewardAmount,
        address contractAddress,
        bytes4 methodId, //bytes4(keccak256(bytes(fnSig))
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
                    methodId,
                    encodedParams
                ))
            )
        );
        require(callSuccess && checkResult, "VerificationGateway: sig not verified with nonce+data");

        if (tokenRewardAmount > 0) {
            bool success = walletFromHash[publicKeyHash].payTokenAmount(
                paymentToken,
                msg.sender,
                tokenRewardAmount
            );
            require(success, "VerificationGateway: Could not pay nominated reward");
        }

        bool result = walletFromHash[publicKeyHash].action(
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
    @param signature aggregated signature
    @param txs transaction data to be processed
    @param txNonces wallet nonce per tx in txs
    */
    function verifySignatures(
        uint256[2] calldata signature,
        TxData[] calldata txs,
        uint256[] memory txNonces
    ) public view {
        uint256 txCount = txs.length;
        uint256[BLS_LEN][] memory publicKeys = new uint256[BLS_LEN][](txCount);
        uint256[2][] memory messages = new uint256[2][](txCount);

        for (uint256 i = 0; i<txCount; i++) {
            // construct params for signature verification
            publicKeys[i] = blsKeysFromHash[txs[i].publicKeyHash];
            messages[i] = messagePoint(
                txNonces[i],
                txs[i].tokenRewardAmount,
                txs[i].contractAddress,
                keccak256(abi.encodePacked(
                    txs[i].methodId,
                    txs[i].encodedParams
                ))
            );
        }

        (bool checkResult, bool callSuccess) = BLS.verifyMultiple(
            signature,
            publicKeys,
            messages
        );

        require(callSuccess && checkResult, "VerificationGateway: All sigs not verified");
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
        verifySignatures(signature, txs, txNonces);

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
                        txs[i].contractAddress,
                        txs[i].methodId,
                        txs[i].encodedParams
                    );
                }
            }
        }

        // (bool checkResult, bool callSuccess) = BLS.verifyMultiple(
        //     signature,
        //     publicKeys,
        //     messages
        // );
        // // revert everything if signatures not satisfied
        // require(callSuccess && checkResult, "VerificationGateway: All sigs not verified");
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