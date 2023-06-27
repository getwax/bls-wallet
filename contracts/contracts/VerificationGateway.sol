//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;

import "./lib/IBLS.sol"; // to use a deployed BLS library

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import "./interfaces/IWallet.sol";
import "./BLSWallet.sol";

/**
A non-upgradable gateway used to create BLSWallets and call them with
verified Operations that have been respectively signed.
The gateway holds a single ProxyAdmin contract for all wallets, and can
only called by a wallet that the VG created, and only if the first param
is the calling wallet's address.
 */
contract VerificationGateway
{
    bytes32 WALLET_DOMAIN;
    bytes32 BUNDLE_DOMAIN;
    string constant BLS_DOMAIN_NAME = "BLS_WALLET";
    string constant BLS_DOMAIN_VERSION = "1";
    uint8 constant BLS_KEY_LEN = 4;

    IBLS public immutable blsLib;
    ProxyAdmin public immutable walletProxyAdmin = new ProxyAdmin();
    BLSWallet public immutable blsWalletLogic = new BLSWallet();
    mapping(bytes32 => IWallet) public walletFromHash;
    mapping(IWallet => bytes32) public hashFromWallet;
    mapping(bytes32 => uint256[BLS_KEY_LEN]) public BLSPublicKeyFromHash;

    // mapping from an existing wallet's bls key hash to pending variables when setting a new BLS key
    mapping(bytes32 => uint256[BLS_KEY_LEN]) public pendingBLSPublicKeyFromHash;
    mapping(bytes32 => uint256[2]) public pendingMessageSenderSignatureFromHash;
    mapping(bytes32 => uint256) public pendingBLSPublicKeyTimeFromHash;

    event WalletCreated(
        address indexed wallet,
        uint256[BLS_KEY_LEN] publicKey
    );

    event WalletOperationProcessed(
        address indexed wallet,
        uint256 nonce,
        IWallet.ActionData[] actions,
        bool success,
        bytes[] results
    );

    event PendingBLSKeySet(
        bytes32 previousHash,
        uint256[BLS_KEY_LEN] newBLSKey
    );
    event BLSKeySetForWallet(
        uint256[BLS_KEY_LEN] newBLSKey,
        IWallet wallet
    );

    /**
    @param bls verified bls library contract address
     */
    constructor(IBLS bls) {
        blsLib = bls;
        blsWalletLogic.initialize(address(0));
        WALLET_DOMAIN = keccak256(abi.encodePacked(
            BLS_DOMAIN_NAME,
            BLS_DOMAIN_VERSION,
            block.chainid,
            address(this),
            "Wallet"
        ));
        BUNDLE_DOMAIN = keccak256(abi.encodePacked(
            BLS_DOMAIN_NAME,
            BLS_DOMAIN_VERSION,
            block.chainid,
            address(this),
            "Bundle"
        ));
    }

    /** Throw if bundle not valid or signature verification fails */
    function verify(
        IWallet.Bundle memory bundle
    ) public view {
        uint256 opLength = bundle.operations.length;
        require(
            opLength == bundle.senderPublicKeys.length,
            "VG: length mismatch"
        );
        uint256[2][] memory messages = new uint256[2][](opLength);

        for (uint256 i = 0; i<opLength; i++) {
            // construct params for signature verification
            bytes32 keyHash = keccak256(abi.encodePacked(bundle.senderPublicKeys[i]));
            address walletAddress = address(walletFromHash[keyHash]);
            if (walletAddress == address(0)) {
                walletAddress = address(uint160(uint256(keccak256(abi.encodePacked(
                    bytes1(0xff),
                    address(this),
                    keyHash,
                    keccak256(abi.encodePacked(
                        type(TransparentUpgradeableProxy).creationCode,
                        abi.encode(
                            address(blsWalletLogic),
                            address(walletProxyAdmin),
                            getInitializeData()
                        )
                    ))
                )))));
            }
            messages[i] = messagePoint(
                walletAddress,
                bundle.operations[i]
            );
        }

        bool verified = blsLib.verifyMultiple(
            bundle.signature,
            bundle.senderPublicKeys,
            messages
        );

        require(verified, "VG: Sig not verified");
    }

    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) public view returns (bool verified) {
        IWallet wallet = IWallet(msg.sender);
        bytes32 existingHash = hashFromWallet[wallet];
        require(existingHash != 0, "VG: not called from wallet");

        uint256[BLS_KEY_LEN] memory publicKey = BLSPublicKeyFromHash[existingHash];

        bytes memory hashBytes = abi.encode(hash);

        uint256[2] memory message = blsLib.hashToPoint(
            WALLET_DOMAIN,
            hashBytes
        );

        require(signature.length == 64, "VG: Sig bytes length must be 64");
        uint256[2] memory decodedSignature = abi.decode(signature, (uint256[2]));

        verified = blsLib.verifySingle(decodedSignature, publicKey, message);
    }

    /**
    If an existing wallet contract wishes to be called by this verification
    gateway, it can directly register itself with a simple signed msg.
    NB: this is independent of the proxyAdmin, and if desired can be changed
    via the corresponding call.
    @dev overrides previous wallet address registered with the given public key
    @param messageSenderSignature signature of message containing only the calling address
    @param publicKey that signed the caller's address
     */
    function setBLSKeyForWallet(
        uint256[2] memory messageSenderSignature,
        uint256[BLS_KEY_LEN] memory publicKey
    ) public {
        require(blsLib.isZeroBLSKey(publicKey) == false, "VG: key is zero");
        IWallet wallet = IWallet(msg.sender);
        bytes32 existingHash = hashFromWallet[wallet];

        // Can't register new wallet contracts, only what this gateway deployed.
        if (existingHash != bytes32(0)) { // wallet already has a key registered, set after delay
            pendingMessageSenderSignatureFromHash[existingHash] = messageSenderSignature;
            pendingBLSPublicKeyFromHash[existingHash] = publicKey;
            pendingBLSPublicKeyTimeFromHash[existingHash] = block.timestamp + 604800; // 1 week from now
            emit PendingBLSKeySet(existingHash, publicKey);
        }
    }
    /** 
    @param signatureExpiryTimestamp that the signature is valid until
    */
    function setPendingBLSKeyForWallet(uint256 signatureExpiryTimestamp) public {
        IWallet wallet = IWallet(msg.sender);
        bytes32 existingHash = hashFromWallet[wallet];
        require(existingHash != bytes32(0), "VG: hash not found");
        if (
            (pendingBLSPublicKeyTimeFromHash[existingHash] != 0) &&
            (block.timestamp > pendingBLSPublicKeyTimeFromHash[existingHash])
        ) {
            safeSetWallet(
                pendingMessageSenderSignatureFromHash[existingHash],
                pendingBLSPublicKeyFromHash[existingHash],
                wallet,
                signatureExpiryTimestamp
            );
            pendingMessageSenderSignatureFromHash[existingHash] = [0,0];
            pendingBLSPublicKeyTimeFromHash[existingHash] = 0;
            pendingBLSPublicKeyFromHash[existingHash] = [0,0,0,0];
        }
    }

    /**
    Calls to proxy admin, exclusively from a wallet. Must be called twice.
    Once to set the function in the wallet as pending, then again after the recovery time.
    @param hash calling wallet's bls public key hash
    @param encodedFunction the selector and params to call (first encoded param must be calling wallet)
     */
    function walletAdminCall(
        bytes32 hash,
        bytes memory encodedFunction
    ) public onlyWallet(hash) {
        IWallet wallet = walletFromHash[hash];

        // ensure first parameter is the calling wallet address
        bytes memory encodedAddress = abi.encode(address(wallet));
        uint8 selectorOffset = 4;

        bytes4 selectorId = bytes4(encodedFunction);

        // ensure not calling Ownable functions of ProxyAdmin
        require((selectorId != Ownable.transferOwnership.selector)
            && (selectorId != Ownable.renounceOwnership.selector),
            "VG: cannot change ownership"
        );

        if (selectorId != Ownable.owner.selector) {
            require(encodedFunction.length >= 32, "VG: Expected admin params");
            for (uint256 i=0; i<32; i++) {
                require(
                    (encodedFunction[selectorOffset+i] == encodedAddress[i]),
                    "VG: first param is not wallet"
                );
            }
        }

        require((selectorId != ProxyAdmin.upgrade.selector)
            && (selectorId != ProxyAdmin.upgradeAndCall.selector),
            "VG: wallet not upgradable"
        );

        wallet.setAnyPending();

        // ensure wallet has pre-approved encodedFunction
        bytes32 approvedFunctionHash = wallet.approvedProxyAdminFunctionHash();
        bytes32 encodedFunctionHash = keccak256(encodedFunction);
        bool matchesApproved = encodedFunctionHash == approvedFunctionHash;

        if (matchesApproved == false) {
            // prepare for a future call
            wallet.setProxyAdminFunctionHash(encodedFunctionHash);
        }
        else {
            // call approved function
            (bool success, ) = address(walletProxyAdmin).call(encodedFunction);
            require(success, "VG: call to proxy admin failed");
            wallet.clearApprovedProxyAdminFunctionHash();
        }
    }

    /**
    Recovers a wallet, setting a new bls public key.
    @param walletAddressSignature signature of message containing only the wallet address
    @param blsKeyHash calling wallet's bls public key hash
    @param salt used in the recovery hash
    @param newBLSKey to set as the wallet's bls public key
    @param signatureExpiryTimestamp that the signature is valid until
     */
    function recoverWallet(
        uint256[2] memory walletAddressSignature,
        bytes32 blsKeyHash,
        bytes32 salt,
        uint256[BLS_KEY_LEN] memory newBLSKey,
        uint256 signatureExpiryTimestamp
    ) public {
        IWallet wallet = walletFromHash[blsKeyHash];
        bytes32 recoveryHash = keccak256(
            abi.encodePacked(msg.sender, blsKeyHash, salt)
        );
        if (recoveryHash == wallet.recoveryHash()) {
            safeSetWallet(walletAddressSignature, newBLSKey, wallet, signatureExpiryTimestamp);
            wallet.recover();
        }
    }

    /**
    Wallet can migrate to a new gateway, eg additional signature support
     */
    function setTrustedBLSGateway(
        bytes32 hash,
        address blsGateway
    ) public onlyWallet(hash) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly { size := extcodesize(blsGateway) }
        require(
            (blsGateway != address(0)) && (size > 0),
            "VG: invalid gateway"
        );

        IWallet wallet = walletFromHash[hash];

        require(
            VerificationGateway(blsGateway).walletFromHash(hash) == wallet,
            "Not recognized"
        );

        // getProxyAdmin fails if not called by the current proxy admin, so this
        // enforces that the wallet's proxy admin matches the one in the new
        // gateway.
        VerificationGateway(blsGateway).walletProxyAdmin().getProxyAdmin(
            TransparentUpgradeableProxy(payable(address(wallet)))
        );

        wallet.setTrustedGateway(blsGateway);
    }

    /**
    Base function for verifying and processing BLS-signed transactions.
    Creates a new contract wallet per bls key if existing wallet not found.
    Can be called with a single operation with no actions.
    */
    function processBundle(
        IWallet.Bundle memory bundle
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
            if (bundle.operations[i].nonce == wallet.nonce{gas:20000}()) {
                // request wallet perform operation
                (
                    bool success,
                    bytes[] memory resultSet
                ) = wallet.performOperation{gas:bundle.operations[i].gas}(bundle.operations[i]);
                successes[i] = success;
                results[i] = resultSet;
                emit WalletOperationProcessed(
                    address(wallet),
                    bundle.operations[i].nonce,
                    bundle.operations[i].actions,
                    successes[i],
                    results[i]
                );
            }
        }
    }

    /**
    Gets the wallet contract associated with the public key, creating it if
    needed.
     */
    function getOrCreateWallet(
        uint256[BLS_KEY_LEN] memory publicKey
    ) private returns (IWallet) {
        bytes32 publicKeyHash = keccak256(abi.encodePacked(publicKey));
        IWallet blsWallet = walletFromHash[publicKeyHash];
        // publicKeyHash does not yet refer to a wallet, create one then update mappings.
        if (address(blsWallet) == address(0)) {
            blsWallet = IWallet(address(new TransparentUpgradeableProxy{salt: publicKeyHash}(
                address(blsWalletLogic),
                address(walletProxyAdmin),
                getInitializeData()
            )));
            updateWalletHashMappings(publicKeyHash, blsWallet, publicKey);
            emit WalletCreated(
                address(blsWallet),
                publicKey
            );
        }
        return IWallet(blsWallet);
    }

    /**
     * Utility for measuring the gas used by an operation, suitable for use in
     * the operation's required gas parameter.
     *
     * This has two important differences over standard estimateGas methods:
     *   1. It does not include gas for calldata, which has already been paid
     *   2. It works for wallets which don't yet exist
     */
    function measureOperationGas(
        uint256[BLS_KEY_LEN] memory publicKey,
        IWallet.Operation calldata op
    ) external returns (uint256) {
        // Don't allow this to actually be executed on chain. Static calls only.
        require(msg.sender == address(0), "VG: read only");

        IWallet wallet = getOrCreateWallet(publicKey);

        uint256 gasBefore = gasleft();
        wallet.performOperation(op);
        uint256 gasUsed = gasBefore - gasleft();

        return gasUsed;
    }

    /**
    @dev safely sets/overwrites the wallet for the given public key, ensuring it is properly signed
    @param walletAddressSignature signature of message containing only the wallet address
    @param publicKey that signed the wallet address
    @param wallet address to set
    @param signatureExpiryTimestamp that the signature is valid until
     */
    function safeSetWallet(
        uint256[2] memory walletAddressSignature,
        uint256[BLS_KEY_LEN] memory publicKey,
        IWallet wallet,
        uint256 signatureExpiryTimestamp
    ) private {
        require(
            block.timestamp < signatureExpiryTimestamp,
            "VG: message expired"
        );
        // verify the given wallet was signed for by the bls key
        uint256[2] memory addressMsg = blsLib.hashToPoint(
            WALLET_DOMAIN,
            abi.encodePacked(wallet, signatureExpiryTimestamp)
        );
        require(
            blsLib.verifySingle(walletAddressSignature, publicKey, addressMsg),
            "VG: Sig not verified"
        );
        bytes32 publicKeyHash = keccak256(abi.encodePacked(
            publicKey
        ));
        emit BLSKeySetForWallet(publicKey, wallet);
        updateWalletHashMappings(publicKeyHash, wallet, publicKey);
    }

    /** @dev Only to be called on wallet creation, and in `safeSetWallet` */
    function updateWalletHashMappings(
        bytes32 publicKeyHash,
        IWallet wallet,
        uint256[BLS_KEY_LEN] memory publicKey
    ) private {
        // remove reference from old hash
        bytes32 oldHash = hashFromWallet[wallet];
        walletFromHash[oldHash] = IWallet(address(0));
        BLSPublicKeyFromHash[oldHash] = [0,0,0,0];

        // update new hash / wallet mappings
        walletFromHash[publicKeyHash] = wallet;
        hashFromWallet[wallet] = publicKeyHash;
        BLSPublicKeyFromHash[publicKeyHash] = publicKey;
    }

    function getInitializeData() private view returns (bytes memory) {
        return abi.encodeWithSignature("initialize(address)", address(this));
    }

    modifier onlyWallet(bytes32 hash) {
        require(
            (IWallet(msg.sender) == walletFromHash[hash]),
            "VG: not called from wallet"
        );
        _;
    }

    function messagePoint(
        address walletAddress,
        IWallet.Operation memory op
    ) internal view returns (
        uint256[2] memory
    ) {
        bytes memory encodedActionData;
        IWallet.ActionData memory a;
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
            BUNDLE_DOMAIN,
            abi.encodePacked(
                walletAddress,
                op.nonce,
                keccak256(encodedActionData)
            )
        );
    }

}