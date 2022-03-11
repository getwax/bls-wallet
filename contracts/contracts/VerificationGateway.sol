//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;

import "./lib/IBLS.sol"; // to use a deployed BLS library

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import "./interfaces/IWallet.sol";

/**
A non-upgradable gateway used to create BLSWallets and call them with
verified Operations that have been respectively signed.
The gateway holds a single ProxyAdmin contract for all wallets, and can
only called by a wallet that the VG created, and only if the first param
is the calling wallet's address.
 */
contract VerificationGateway
{
    /** Domain chosen arbitrarily */
    bytes32 BLS_DOMAIN = keccak256(abi.encodePacked(uint32(0xfeedbee5)));
    uint8 constant BLS_KEY_LEN = 4;

    uint256 public constant AUTH_DELAY = 604800; // 7 days

    bytes32 public constant PROXY_ADMIN_FUNCTION_HASH_AUTH_ID
        // keccak256("proxyAdminFunctionHash")
        = 0xf7f75a0694ef66d3fbc2b1c58fa96cc5a0e85d8f7ef5e4663a2c37c339b3cb9e;

    bytes32 public constant RECOVERY_HASH_AUTH_ID
        // keccak256("recoveryHash")
        = 0x27690924264ef7d5a40864fd354bdcd43328b7f9e2b82210e410627ee6f95983;

    IBLS public blsLib;
    ProxyAdmin public immutable walletProxyAdmin;
    address public blsWalletLogic;
    mapping(bytes32 => IWallet) externalWalletsFromHash;


    /** Aggregated signature with corresponding senders + operations */
    struct Bundle {
        uint256[2] signature;
        uint256[BLS_KEY_LEN][] senderPublicKeys;
        IWallet.Operation[] operations;
    }

    event WalletCreated(
        address indexed wallet,
        uint256[BLS_KEY_LEN] publicKey
    );

    event WalletOperationProcessed(
        address indexed wallet,
        uint256 nonce,
        bool result
    );


    /**
    @param bls verified bls library contract address
     */
    constructor(
        IBLS bls,
        address blsWalletImpl
    ) {
        blsLib = bls;
        blsWalletLogic = blsWalletImpl;
        walletProxyAdmin = new ProxyAdmin();
    }

    /** Throw if bundle not valid or signature verification fails */
    function verify(
        Bundle calldata bundle
    ) public view {
        uint256 opLength = bundle.operations.length;
        require(
            opLength == bundle.senderPublicKeys.length,
            "VG: Sender and operation length mismatch"
        );
        uint256[2][] memory messages = new uint256[2][](opLength);

        for (uint256 i = 0; i<opLength; i++) {
            // construct params for signature verification
            messages[i] = messagePoint(bundle.operations[i]);
        }

        bool verified = blsLib.verifyMultiple(
            bundle.signature,
            bundle.senderPublicKeys,
            messages
        );

        require(verified, "VG: All sigs not verified");
    }

    /**
    Returns a BLSWallet if deployed from this contract, otherwise 0.
    @param hash BLS public key hash used as salt for create2
    @return BLSWallet at calculated address (if code exists), otherwise zero address
     */
    function walletFromHash(bytes32 hash) public view returns (IWallet) {
        //return wallet of hash registered explicitly
        if (externalWalletsFromHash[hash] != IWallet(address(0))) {
            return externalWalletsFromHash[hash];
        }

        address walletAddress = address(uint160(uint(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            hash,
            keccak256(abi.encodePacked(
                type(TransparentUpgradeableProxy).creationCode,
                abi.encode(
                    address(blsWalletLogic),
                    address(walletProxyAdmin),
                    getInitializeData()
                )
            ))
        )))));
        if (!hasCode(walletAddress)) {
            walletAddress = address(0);
        }
        return IWallet(payable(walletAddress));
    }

    /**
    If an existing wallet contract wishes to be called by this verification
    gateway, it can directly register itself with a simple signed msg.
    NB: this is independent of the proxyAdmin, and if desired can be changed
    via the corresponding call.
    @dev overrides previous wallet address registered with the given public key
    @param signature of message containing only the calling address
    @param publicKey that signed the caller's address
     */
    function setExternalWallet(
        uint256[2] calldata signature,
        uint256[BLS_KEY_LEN] calldata publicKey
    ) public {
        uint256[2] memory addressMsg = blsLib.hashToPoint(
            BLS_DOMAIN,
            abi.encodePacked(msg.sender)
        );
        require(
            blsLib.verifySingle(signature, publicKey, addressMsg),
            "VG: Signature not verified for wallet address."
        );
        bytes32 publicKeyHash = keccak256(abi.encodePacked(
            publicKey
        ));
        externalWalletsFromHash[publicKeyHash] = IWallet(msg.sender);
    }

    function authorizeWalletAdminCall(
        bytes32 hash,
        bytes32 proxyAdminFunctionHash
    ) public onlyWallet(hash) {
        walletFromHash(hash).authorize(
            PROXY_ADMIN_FUNCTION_HASH_AUTH_ID,
            AUTH_DELAY,
            proxyAdminFunctionHash
        );
    }

    /**
    Calls to proxy admin, exclusively from a wallet. Must be called twice.
    Once to set the function in the wallet as pending, then again after the recovery time.
    @param hash calling wallet's bls public key hash
    @param encodedFunction the selector and params to call (first encoded param must be calling wallet)
     */
    function walletAdminCall(
        bytes32 hash,
        bytes calldata encodedFunction
    ) public onlyWallet(hash) {
        IWallet wallet = walletFromHash(hash);

        // ensure first parameter is the calling wallet address
        bytes memory encodedAddress = abi.encode(address(wallet));
        uint8 selectorOffset = 4;
        for (uint256 i=0; i<32; i++) {
            require(
                (encodedFunction[selectorOffset+i] == encodedAddress[i]),
                "VG: first param to proxy admin is not calling wallet"
            );
        }

        wallet.consumeAuthorization(
            PROXY_ADMIN_FUNCTION_HASH_AUTH_ID,
            AUTH_DELAY,
            keccak256(encodedFunction)
        );

        // call approved function
        (bool success, ) = address(walletProxyAdmin).call(encodedFunction);
        require(success, "VG: call to proxy admin failed");
    }

    function authorizeRecoverWallet(
        bytes32 hash,
        bytes32 recoveryHash
    ) public onlyWallet(hash) {
        walletFromHash(hash).authorize(
            RECOVERY_HASH_AUTH_ID,
            AUTH_DELAY,
            recoveryHash
        );
    }

    function recoverWallet(
        bytes32 blsKeyHash,
        uint256[4] memory newBLSKey
    ) public {
        IWallet wallet = walletFromHash(blsKeyHash);
        bytes32 recoveryHash = keccak256(
            abi.encodePacked(msg.sender, blsKeyHash, newBLSKey)
        );
        wallet.consumeAuthorization(
            RECOVERY_HASH_AUTH_ID,
            AUTH_DELAY,
            recoveryHash
        );
        // override mapping of old key hash (takes precedence over create2 address)
        externalWalletsFromHash[blsKeyHash] = IWallet(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
        bytes32 newKeyHash = keccak256(abi.encodePacked(newBLSKey));
        externalWalletsFromHash[newKeyHash] = wallet;
    }

    /** 
    Base function for verifying and processing BLS-signed transactions.
    Creates a new contract wallet per bls key if existing wallet not found.
    Can be called with a single operation with no actions.
    */
    function processBundle(
        Bundle calldata bundle
    ) external returns (
        bool[] memory successes,
        bytes[][] memory results
    ) {
        // revert if signature not verified
        verify(bundle);

        uint256 opLength = bundle.operations.length;
        successes = new bool[](opLength);
        results = new bytes[][](opLength);
        for (uint256 i = 0; i<opLength; i++) {
            IWallet wallet = getOrCreateWallet(bundle.senderPublicKeys[i]);

            // check nonce then perform action
            if (bundle.operations[i].nonce == wallet.nonce()) {
                // request wallet perform operation
                (
                    bool success,
                    bytes[] memory resultSet
                ) = wallet.performOperation(bundle.operations[i]);
                successes[i] = success;
                results[i] = resultSet;
                emit WalletOperationProcessed(
                    address(wallet),
                    bundle.operations[i].nonce,
                    successes[i]
                );
            }
        }
    }

    /**
    Gets the wallet contract associated with the public key, creating it if
    needed.
     */
    function getOrCreateWallet(
        uint256[BLS_KEY_LEN] calldata publicKey
    ) private returns (IWallet) {
        bytes32 publicKeyHash = keccak256(abi.encodePacked(publicKey));
        address blsWallet = address(walletFromHash(publicKeyHash));
        // wallet with publicKeyHash doesn't exist at expected create2 address
        if (blsWallet == address(0)) {
            blsWallet = address(new TransparentUpgradeableProxy{salt: publicKeyHash}(
                address(blsWalletLogic),
                address(walletProxyAdmin),
                getInitializeData()
            ));
            emit WalletCreated(
                address(blsWallet),
                publicKey
            );
        }
        return IWallet(blsWallet);
    }

    function hasCode(address a) private view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly { size := extcodesize(a) }
        return size > 0;
    }

    function getInitializeData() private view returns (bytes memory) {
        return abi.encodeWithSignature("initialize(address)", address(this));
    }

    modifier onlyWallet(bytes32 hash) {
        require(
            (msg.sender == address(walletFromHash(hash))),
            "VG: not called from wallet"
        );
        _;
    }

    function messagePoint(
        IWallet.Operation calldata op
    ) internal view returns (
        uint256[2] memory
    ) {
        bytes memory encodedActionData;
        IWallet.ActionData calldata a;
        for (uint256 i=0; i<op.actions.length; i++) {
            a = op.actions[i];
            encodedActionData = abi.encodePacked(
                encodedActionData,
                a.ethValue,
                a.contractAddress,
                keccak256(a.encodedFunction)
            );
        }
        return blsLib.hashToPoint(
            BLS_DOMAIN,
            abi.encodePacked(
                block.chainid,
                op.nonce,
                keccak256(encodedActionData)
            )
        );
    }

}
