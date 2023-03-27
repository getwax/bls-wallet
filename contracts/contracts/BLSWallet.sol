//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;


//To avoid constructor params having forbidden evm bytecodes on Optimism
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IWallet.sol";

interface IVerificationGateway {
    function isValidSignature(bytes32 _hash, bytes memory _signature) external view returns (bool);
}

/** Minimal upgradable smart contract wallet.
    Generic calls can only be requested by its trusted gateway.
 */
contract BLSWallet is Initializable, IWallet
{
    uint256 public nonce;
    bytes32 public recoveryHash;
    bytes32 pendingRecoveryHash;
    uint256 pendingRecoveryHashTime;
    bytes32 public approvedProxyAdminFunctionHash;
    bytes32 pendingPAFunctionHash;
    uint256 pendingPAFunctionTime;

    // BLS variables
    address public trustedBLSGateway;
    address pendingBLSGateway;
    uint256 pendingGatewayTime;

    event PendingRecoveryHashSet(
        bytes32 pendingRecoveryHash
    );
    event PendingGatewaySet(
        address pendingGateway
    );
    event PendingProxyAdminFunctionHashSet(
        bytes32 pendingProxyAdminFunctionHash
    );

    event RecoveryHashUpdated(
        bytes32 oldHash,
        bytes32 newHash
    );
    event GatewayUpdated(
        address oldGateway,
        address newGateway
    );
    event ProxyAdminFunctionHashApproved(
        bytes32 approvedProxyAdminHash
    );

    function initialize(
        address blsGateway
    ) external initializer {
        nonce = 0;
        trustedBLSGateway = blsGateway;
    }

    receive() external payable {}
    fallback() external payable {}

    /**
    Wallet can update its recovery hash
     */
    function setRecoveryHash(bytes32 hash) public onlyThis {
        if (recoveryHash == bytes32(0)) {
            recoveryHash = hash;
            clearPendingRecoveryHash();
            emit RecoveryHashUpdated(bytes32(0), recoveryHash);
        }
        else {
            pendingRecoveryHash = hash;
            pendingRecoveryHashTime = block.timestamp + 604800; // 1 week from now
            emit PendingRecoveryHashSet(pendingRecoveryHash);
        }
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
    function setProxyAdminFunctionHash(bytes32 encodedFunctionHash) public onlyTrustedGateway {
        pendingPAFunctionHash = encodedFunctionHash;
        pendingPAFunctionTime = block.timestamp + 604800; // 1 week from now
        emit PendingProxyAdminFunctionHashSet(encodedFunctionHash);
    }

    /**
    Set results of any pending set operation if their respective timestamp has elapsed.
     */
    function setAnyPending() public {
        if (pendingRecoveryHashTime != 0 &&
            block.timestamp > pendingRecoveryHashTime
        ) {
            bytes32 previousRecoveryHash = recoveryHash;
            recoveryHash = pendingRecoveryHash;
            clearPendingRecoveryHash();
            emit RecoveryHashUpdated(previousRecoveryHash, recoveryHash);
        }
        if (pendingGatewayTime != 0 &&
            block.timestamp > pendingGatewayTime
        ) {
            address previousGateway = trustedBLSGateway;
            trustedBLSGateway = pendingBLSGateway;
            pendingGatewayTime = 0;
            pendingBLSGateway = address(0);
            emit GatewayUpdated(previousGateway, trustedBLSGateway);
        }
        if (
            pendingPAFunctionTime != 0 &&
            block.timestamp > pendingPAFunctionTime
        ) {
            approvedProxyAdminFunctionHash = pendingPAFunctionHash;
            pendingPAFunctionTime = 0;
            pendingPAFunctionHash = 0;
            emit ProxyAdminFunctionHashApproved(approvedProxyAdminFunctionHash);
        }
    }

    function clearPendingRecoveryHash() internal {
        pendingRecoveryHashTime = 0;
        pendingRecoveryHash = bytes32(0);
    }

    function recover() public onlyTrustedGateway {
        // clear any pending operations
        clearPendingRecoveryHash();
        pendingGatewayTime = 0;
        pendingBLSGateway = address(0);
        pendingPAFunctionTime = 0;
        pendingPAFunctionHash = 0;
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
        incrementNonce(); // before operation to prevent reentrancy
        try this._performOperation(op) returns (
            bytes[] memory _results
        ) {
            success = true;
            results = _results;
        }
        catch (bytes memory returnData) {
            success = false;
            results = new bytes[](1);
            results[0] = returnData;
        }
    }

    /**
    @dev Restricted to only be called by this contract, but needs to be public
    so that it can be used in the try/catch block.
    Throws if any action does not succeed.
     */
    function _performOperation(
        IWallet.Operation calldata op
    ) public payable onlyThis returns (
        bytes[] memory results
    ) {
        bytes memory result;
        results = new bytes[](op.actions.length);

        IWallet.ActionData calldata a;
        bool success;
        for (uint256 i=0; i<op.actions.length; i++) {
            a = op.actions[i];
            if (a.ethValue > 0) {
                (success, result) = payable(a.contractAddress).call{value: a.ethValue}(a.encodedFunction);
            }
            else {
                (success, result) = address(a.contractAddress).call(a.encodedFunction);
            }

            if (success == false) {
                revert IWallet.ActionError(i, result);
            }

            results[i] = result;
        }
    }

    /**
    * @dev ERC-1271 signature validation
    */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) public view returns (bytes4 magicValue) {
        bool verified = IVerificationGateway(trustedBLSGateway).isValidSignature(hash, signature);

        if (verified) {
            magicValue = 0x1626ba7e;
        } else {
            magicValue = 0xffffffff;
        }
    }

    function stripMethodId(bytes memory encodedFunction) pure private returns(bytes memory) {
        bytes memory params = new bytes(encodedFunction.length - 4);
        for (uint256 i=0; i<params.length; i++) {
            params[i] = encodedFunction[i+4];
        }
        return params;
    }

    function clearApprovedProxyAdminFunctionHash() public onlyTrustedGateway {
        approvedProxyAdminFunctionHash = 0;
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
