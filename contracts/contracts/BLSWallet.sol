//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;


//To avoid constructor params having forbidden evm bytecodes on Optimism
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IWallet.sol";


/** Minimal upgradable smart contract wallet.
    Generic calls can only be requested by its trusted gateway.
 */
contract BLSWallet is Initializable, IBLSWallet
{
    uint256 public nonce;
    bytes32 public recoveryHash;
    bytes32 pendingRecoveryHash;
    uint256 pendingRecoveryHashTime;
    bytes public approvedProxyAdminFunction;
    bytes pendingPAFunction;
    uint256 pendingPAFunctionTime;

    // BLS variables
    uint256[4] public blsPublicKey;
    uint256[4] pendingBLSPublicKey;
    uint256 pendingBLSPublicKeyTime;
    address public trustedBLSGateway;
    address pendingBLSGateway;
    uint256 pendingGatewayTime;

    event PendingRecoveryHashSet(
        bytes32 pendingRecoveryHash
    );
    event PendingBLSKeySet(
        uint256[4] pendingBLSKey
    );
    event PendingGatewaySet(
        address pendingGateway
    );
    event PendingProxyAdminFunctionSet(
        bytes pendingProxyAdminFunction
    );

    event RecoveryHashUpdated(
        bytes32 oldHash,
        bytes32 newHash
    );
    event BLSKeySet(
        uint256[4] oldBLSKey,
        uint256[4] newBLSKey
    );
    event GatewayUpdated(
        address oldGateway,
        address newGateway
    );
    event ProxyAdminFunctionApproved(
        bytes approvedProxyAdmin
    );

    function initialize(
        address blsGateway
    ) external initializer {
        nonce = 0;
        trustedBLSGateway = blsGateway;
        pendingGatewayTime = type(uint256).max;
        pendingPAFunctionTime = type(uint256).max;
    }

    /** */
    function latchBLSPublicKey(
        uint256[4] memory blsKey
    ) public onlyTrustedGateway {
        require(isZeroBLSKey(blsPublicKey), "BLSWallet: public key already set");
        blsPublicKey = blsKey;
    }

    function isZeroBLSKey(uint256[4] memory blsKey) public pure returns (bool) {
        bool isZero = true;
        for (uint256 i=0; isZero && i<4; i++) {
            isZero = (blsKey[i] == 0);
        }
        return isZero;
    }

    receive() external payable {}
    fallback() external payable {}

    /**
    BLS public key format, contract can be upgraded for other types
     */
    function getBLSPublicKey() external view returns (uint256[4] memory) {
        return blsPublicKey;
    }

    /**
    Wallet can update its recovery hash
     */
    function setRecoveryHash(bytes32 hash) public onlyThis {
        if (recoveryHash == bytes32(0)) {
            recoveryHash = hash;
            emit RecoveryHashUpdated(bytes32(0), recoveryHash);
        }
        else {
            pendingRecoveryHash = hash;
            pendingRecoveryHashTime = block.timestamp + 604800; // 1 week from now
            emit PendingRecoveryHashSet(pendingRecoveryHash);
        }
    }

    /**
    Wallet can update its BLS key
     */
    function setBLSPublicKey(uint256[4] memory blsKey) public onlyThis {
        require(isZeroBLSKey(blsKey) == false, "BLSWallet: blsKey must be non-zero");
        pendingBLSPublicKey = blsKey;
        pendingBLSPublicKeyTime = block.timestamp + 604800; // 1 week from now
        emit PendingBLSKeySet(pendingBLSPublicKey);
    }

    /**
    Wallet can migrate to a new gateway, eg additional signature support
     */
    function setTrustedGateway(address blsGateway) public onlyTrustedGateway {
        pendingBLSGateway = blsGateway;
        pendingGatewayTime = block.timestamp + 604800; // 1 week from now
        emit PendingGatewaySet(pendingBLSGateway);
    }

    /**
    Prepare wallet with desired implementation contract to upgrade to.
    */
    function setProxyAdminFunction(bytes calldata encodedFunction) public onlyTrustedGateway {
        pendingPAFunction = encodedFunction;
        pendingPAFunctionTime = block.timestamp + 604800; // 1 week from now
        emit PendingProxyAdminFunctionSet(pendingPAFunction);
    }

    /**
    Set results of any pending set operation if their respective timestamp has elapsed.
     */
    function setAnyPending() public {
        if (block.timestamp > pendingRecoveryHashTime) {
            bytes32 previousRecoveryHash = recoveryHash;
            recoveryHash = pendingRecoveryHash;
            pendingRecoveryHashTime = type(uint256).max;
            pendingRecoveryHash = bytes32(0);
            emit RecoveryHashUpdated(previousRecoveryHash, recoveryHash);
        }
        if (block.timestamp > pendingBLSPublicKeyTime) {
            uint256[4] memory previousBLSPublicKey = blsPublicKey;
            blsPublicKey = pendingBLSPublicKey;
            pendingBLSPublicKeyTime = type(uint256).max;
            pendingBLSPublicKey = [0,0,0,0];
            emit BLSKeySet(previousBLSPublicKey, blsPublicKey);
        }
        if (block.timestamp > pendingGatewayTime) {
            address previousGateway = trustedBLSGateway;
            trustedBLSGateway = pendingBLSGateway;
            pendingGatewayTime = type(uint256).max;
            pendingBLSGateway = address(0);
            emit GatewayUpdated(previousGateway, trustedBLSGateway);
        }
        if (block.timestamp > pendingPAFunctionTime) {
            approvedProxyAdminFunction = pendingPAFunction;
            pendingPAFunctionTime = type(uint256).max;
            pendingPAFunction = new bytes(0);
            emit ProxyAdminFunctionApproved(approvedProxyAdminFunction);
        }
    }

    /**
    A regular wallet expects the gateway to verify signed 
    transactions with the wallet's public key, and nonce.
     */
    function performOperation(
        IWallet.Operation calldata op
    ) public payable onlyTrustedGateway thisNonce(op.nonce) returns (
        bool success,
        bytes[] memory results
    ) {
        try this._performOperation(op) returns (
            bool _success,
            bytes[] memory _results
        ) {
            success = _success;
            results = _results;
        }
        catch {
            success = false;
        }
        incrementNonce(); // regardless of outcome of operation
    }

    /**
    @dev Restricted to only be called by this contract, but needs to be public
    so that it can be used in the try/catch block.
     */
    function _performOperation(
        IWallet.Operation calldata op
    ) public payable onlyThis returns (
        bool success,
        bytes[] memory results
    ) {
        bytes memory result;
        results = new bytes[](op.actions.length);

        IWallet.ActionData calldata a;
        for (uint256 i=0; i<op.actions.length; i++) {
            a = op.actions[i];
            if (a.ethValue > 0) {
                (success, result) = payable(a.contractAddress).call{value: a.ethValue}(a.encodedFunction);
            }
            else {
                (success, result) = address(a.contractAddress).call(a.encodedFunction);
            }
            require(success);
            results[i] = result;
        }
    }

    function clearApprovedProxyAdminFunction() public onlyTrustedGateway {
        approvedProxyAdminFunction = new bytes(0);
    }

    /**
    Consecutive nonce increment, contract can be upgraded for other types
     */
    function incrementNonce() private {
        nonce++;
    }

    modifier onlyThis() {
        require(msg.sender == address(this), "BLSWallet: only callable from this");
         _;
    }

    modifier onlyTrustedGateway() {
        bool isTrustedGateway =
            (msg.sender == trustedBLSGateway)
        ;
        require(isTrustedGateway, "BLSWallet: only callable from trusted gateway");
         _;
    }

    modifier thisNonce(uint256 opNonce) {
        require(opNonce == nonce, "BLSWallet: only callable with current nonce");
        _;
    }

}
