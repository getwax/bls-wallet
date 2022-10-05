//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;

import "./lib/IBLS.sol"; // to use a deployed BLS library

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@account-abstraction/contracts/bls/BLSHelper.sol";

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
    /** Domain chosen arbitrarily */
    bytes32 BLS_DOMAIN = keccak256(abi.encodePacked(uint32(0xfeedbee5)));
    uint8 constant BLS_KEY_LEN = 4;

    IBLS public immutable blsLib;
    ProxyAdmin public immutable walletProxyAdmin;
    address public immutable blsWalletLogic;
    mapping(bytes32 => BLSWallet) public walletFromHash;

    //mapping from an existing wallet's bls key hash to pending variables when setting a new BLS key
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
    constructor(
        IBLS bls,
        address blsWalletImpl,
        address proxyAdmin
    ) {
        blsLib = bls;
        blsWalletLogic = blsWalletImpl;
        walletProxyAdmin = ProxyAdmin(proxyAdmin);
    }

    /** Throw if bundle not valid or signature verification fails */
    function validateSignatures(
        UserOperation[] calldata userOps,
        bytes calldata signature
    ) view external {
        uint256[2][] memory messages = new uint256[2][](userOps.length);
        uint256[BLS_KEY_LEN][] memory senderPublicKeys = new uint256[BLS_KEY_LEN][](userOps.length);

        for (uint256 i = 0; i < userOps.length; i++) {
            messages[i] = blsLib.hashToPoint(
                BLS_DOMAIN,
                abi.encodePacked(getRequestId(userOps[i]))
            );

            senderPublicKeys[i] = BLSWallet(payable(userOps[i].sender)).getBlsKey();
        }

        bool verified = blsLib.verifyMultiple(
            abi.decode(signature, (uint256[2])),
            senderPublicKeys,
            messages
        );

        require(verified, "VG: Sig not verified");
    }

    // TODO
    // function validateUserOpSignature(
    //     UserOperation4337 calldata userOp,
    //     bool offChainSigCheck
    // ) external view returns (
    //     bytes memory sigForUserOp,
    //     bytes memory sigForAggregation,
    //     bytes memory offChainSigInfo
    // ) {}

    //copied from BLS.sol
    uint256 public constant N = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    function aggregateSignatures(
        bytes[] calldata signatures
    ) external pure returns (bytes memory aggregateSignature) {
        BLSHelper.XY[] memory points = new BLSHelper.XY[](signatures.length);
        for (uint i = 0; i < points.length; i++) {
            (uint x, uint y) = abi.decode(signatures[i], (uint, uint));
            points[i] = BLSHelper.XY(x, y);
        }
        BLSHelper.XY memory sum = BLSHelper.sum(points, N);
        return abi.encode(sum.x, sum.y);
    }

    /**
     * get a hash of userOp
     * NOTE: this hash is not the same as UserOperation.hash()
     *  (slightly less efficient, since it uses memory userOp)
     */
    function getUserOpHash(UserOperation memory userOp) internal pure returns (bytes32) {
        return keccak256(abi.encode(
                userOp.sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.callGasLimit,
                userOp.verificationGasLimit,
                userOp.preVerificationGas,
                userOp.maxFeePerGas,
                userOp.maxPriorityFeePerGas,
                keccak256(userOp.paymasterAndData)
            ));
    }

    /**
     * return the BLS "message" for the given UserOp.
     * the wallet should sign this value using its public-key
     */
    function userOpToMessage(UserOperation memory userOp) public view returns (uint256[2] memory) {
        bytes32 hashPublicKey = _getUserOpPubkeyHash(userOp);
        return _userOpToMessage(userOp, hashPublicKey);
    }

    function _userOpToMessage(UserOperation memory userOp, bytes32 publicKeyHash) internal view returns (uint256[2] memory) {
        bytes32 requestId = _getRequestId(userOp, publicKeyHash);
        return blsLib.hashToPoint(BLS_DOMAIN, abi.encodePacked(requestId));
    }

    //return the public-key hash of a userOp.
    // if its a constructor UserOp, then return constructor hash.
    function _getUserOpPubkeyHash(UserOperation memory userOp) internal view returns (bytes32 hashPublicKey) {
        if (userOp.initCode.length == 0) {
            uint256[4] memory publicKey = BLSWallet(payable(userOp.sender)).getBlsKey();
            hashPublicKey = keccak256(abi.encode(publicKey));
        } else {
            hashPublicKey = keccak256(userOp.initCode);
        }
    }

    function getRequestId(UserOperation memory userOp) public view returns (bytes32) {
        bytes32 hashPublicKey = _getUserOpPubkeyHash(userOp);
        return _getRequestId(userOp, hashPublicKey);
    }

    function _getRequestId(UserOperation memory userOp, bytes32 hashPublicKey) internal view returns (bytes32) {
        return keccak256(abi.encode(getUserOpHash(userOp), hashPublicKey, address(this), block.chainid));
    }

    function hashFromWallet(BLSWallet wallet) public view returns (bytes32) {
        uint256[BLS_KEY_LEN] memory blsKey = wallet.getBlsKey();

        if (blsLib.isZeroBLSKey(blsKey)) {
            return bytes32(0);
        }

        return keccak256(abi.encodePacked(blsKey));
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
        require(blsLib.isZeroBLSKey(publicKey) == false, "VG: publicKey must be non-zero");
        BLSWallet wallet = BLSWallet(payable(msg.sender));
        bytes32 existingHash = hashFromWallet(wallet);
        if (existingHash == bytes32(0)) { // wallet does not yet have a bls key registered with this gateway
            // set it instantly
            safeSetWallet(messageSenderSignature, publicKey, wallet);
        }
        else { // wallet already has a key registered, set after delay
            pendingMessageSenderSignatureFromHash[existingHash] = messageSenderSignature;
            pendingBLSPublicKeyFromHash[existingHash] = publicKey;
            pendingBLSPublicKeyTimeFromHash[existingHash] = block.timestamp + 604800; // 1 week from now
            emit PendingBLSKeySet(existingHash, publicKey);
        }
    }

    function setPendingBLSKeyForWallet() public {
        BLSWallet wallet = BLSWallet(payable(msg.sender));
        bytes32 existingHash = hashFromWallet(wallet);
        require(existingHash != bytes32(0), "VG: hash does not exist for caller");
        if (
            (pendingBLSPublicKeyTimeFromHash[existingHash] != 0) &&
            (block.timestamp > pendingBLSPublicKeyTimeFromHash[existingHash])
        ) {
            safeSetWallet(
                pendingMessageSenderSignatureFromHash[existingHash],
                pendingBLSPublicKeyFromHash[existingHash],
                wallet
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
        for (uint256 i=0; i<32; i++) {
            require(
                (encodedFunction[selectorOffset+i] == encodedAddress[i]),
                "VG: first param to proxy admin is not calling wallet"
            );
        }

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
     */
    function recoverWallet(
        uint256[2] memory walletAddressSignature,
        bytes32 blsKeyHash,
        bytes32 salt,
        uint256[BLS_KEY_LEN] memory newBLSKey
    ) public {
        BLSWallet wallet = walletFromHash[blsKeyHash];
        bytes32 recoveryHash = keccak256(
            abi.encodePacked(msg.sender, blsKeyHash, salt)
        );
        if (recoveryHash == wallet.recoveryHash()) {
            safeSetWallet(walletAddressSignature, newBLSKey, wallet);
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
            "BLSWallet: gateway address param not valid"
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
    Gets the wallet contract associated with the public key, creating it if
    needed.
     */
    function getOrCreateWallet(
        uint256[BLS_KEY_LEN] memory publicKey
    ) private returns (IWallet) {
        bytes32 publicKeyHash = keccak256(abi.encodePacked(publicKey));
        BLSWallet blsWallet = walletFromHash[publicKeyHash];
        // publicKeyHash does not yet refer to a wallet, create one then update mappings.
        if (address(blsWallet) == address(0)) {
            blsWallet = BLSWallet(payable(new TransparentUpgradeableProxy{salt: publicKeyHash}(
                address(blsWalletLogic),
                address(walletProxyAdmin),
                getInitializeData(publicKey)
            )));
            updateWalletHashMappings(publicKey, blsWallet);
            emit WalletCreated(
                address(blsWallet),
                publicKey
            );
        }
        return IWallet(blsWallet);
    }

    /**
    @dev safely sets/overwrites the wallet for the given public key, ensuring it is properly signed
    @param wallletAddressSignature signature of message containing only the wallet address
    @param publicKey that signed the wallet address
    @param wallet address to set
     */
    function safeSetWallet(
        uint256[2] memory wallletAddressSignature,
        uint256[BLS_KEY_LEN] memory publicKey,
        BLSWallet wallet
    ) private {
        // verify the given wallet was signed for by the bls key
        uint256[2] memory addressMsg = blsLib.hashToPoint(
            BLS_DOMAIN,
            abi.encodePacked(wallet)
        );
        require(
            blsLib.verifySingle(wallletAddressSignature, publicKey, addressMsg),
            "VG: Signature not verified for wallet address."
        );
        emit BLSKeySetForWallet(publicKey, wallet);
        updateWalletHashMappings(publicKey, wallet);
    }

    /** @dev Only to be called on wallet creation, and in `safeSetWallet` */
    function updateWalletHashMappings(
        uint256[BLS_KEY_LEN] memory blsKey,
        BLSWallet wallet
    ) private {
        // remove reference from old hash
        bytes32 oldHash = hashFromWallet(wallet);
        delete walletFromHash[oldHash];

        // update new hash / wallet mappings
        walletFromHash[keccak256(abi.encodePacked(blsKey))] = wallet;
        wallet.setBlsKey(blsKey);
    }

    function getInitializeData(uint256[BLS_KEY_LEN] memory blsKey) private view returns (bytes memory) {
        return abi.encodeWithSelector(BLSWallet.initialize.selector, blsKey, address(this));
    }

    modifier onlyWallet(bytes32 hash) {
        require(
            (IWallet(msg.sender) == walletFromHash[hash]),
            "VG: not called from wallet"
        );
        _;
    }

    function messagePoint(
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
            BLS_DOMAIN,
            abi.encodePacked(
                block.chainid,
                op.nonce,
                keccak256(encodedActionData)
            )
        );
    }

}