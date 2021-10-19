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

    IBLS public blsLib;

    /**
    @param bls verified bls library contract address
     */
    function initialize(IBLS bls) external initializer {
        blsLib = bls;
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
        uint256 ethValue;
        address contractAddress;
        bytes encodedFunction;
    }

    /**
    Requires wallet contracts to exist.
    @param signature aggregated signature
    @param txs transaction data to be processed
    */
    function verifySignatures(
        uint256[2] calldata signature,
        TxData[] calldata txs
    ) public view {
        uint256 txCount = txs.length;
        uint256[BLS_LEN][] memory publicKeys = new uint256[BLS_LEN][](txCount);
        uint256[2][] memory messages = new uint256[2][](txCount);

        for (uint256 i = 0; i<txCount; i++) {
            // construct params for signature verification
            publicKeys[i] = blsKeysFromHash[txs[i].publicKeyHash];
            messages[i] = messagePoint(txs[i]);
        }

        bool verified = blsLib.verifyMultiple(
            signature,
            publicKeys,
            messages
        );

        require(verified, "VerificationGateway: All sigs not verified");
    }

    /** 
    Useful no-op function to call when calling a wallet for the first time.
     */
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
        uint256[4][] calldata publicKeys,
        uint256[2] calldata signature,
        TxData[] calldata txs
    ) external {
        createNewWallets(publicKeys, txs);

        verifySignatures(signature, txs);

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


    function messagePoint(
        TxData calldata txData
    ) internal view returns (uint256[2] memory) {
        return blsLib.hashToPoint(
            BLS_DOMAIN,
            abi.encodePacked(
                block.chainid,
                txData.nonce,
                txData.ethValue,
                txData.contractAddress,
                keccak256(txData.encodedFunction)
            )
        );
    }

}