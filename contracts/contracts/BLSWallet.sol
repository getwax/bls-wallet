//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;

//To avoid constructor params having forbidden evm bytecodes on Optimism
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "@account-abstraction/contracts/interfaces/UserOperation.sol";

import "./interfaces/IWallet.sol";

/** Minimal upgradable smart contract wallet.
    Generic calls can only be requested by its trusted gateway.
 */
contract BLSWallet is Initializable, IWallet
{
    uint256 public nonce;
    uint256[4] public blsKey;
    bytes32 public recoveryHash;
    bytes32 pendingRecoveryHash;
    uint256 pendingRecoveryHashTime;
    bytes32 public approvedProxyAdminFunctionHash;
    bytes32 pendingPAFunctionHash;
    uint256 pendingPAFunctionTime;

    // BLS variables
    address public blsGateway;
    address public entryPoint;
    address public aggregator;
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
        uint256[4] memory _blsKey,
        address _blsGateway,
        address _entryPoint,
        address _aggregator
    ) external initializer {
        nonce = 0;
        blsKey = _blsKey;
        blsGateway = _blsGateway;
        entryPoint = _entryPoint;
        aggregator = _aggregator;
    }

    receive() external payable {}
    fallback() external payable {}

    function getBlsKey() external view returns (uint256[4] memory) {
        return blsKey;
    }

    function setBlsKey(uint256[4] memory newBlsKey) external onlyGateway {
        blsKey = newBlsKey;
    }

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
    function setTrustedGateway(address _blsGateway) public onlyGateway {
        pendingBLSGateway = _blsGateway;
        pendingGatewayTime = block.timestamp + 604800; // 1 week from now
        emit PendingGatewaySet(pendingBLSGateway);
    }

    /**
    Prepare wallet with desired implementation contract to upgrade to.
    */
    function setProxyAdminFunctionHash(bytes32 encodedFunctionHash) public onlyGateway {
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
            address previousGateway = blsGateway;
            blsGateway = pendingBLSGateway;
            pendingGatewayTime = 0;
            pendingBLSGateway = address(0);
            emit GatewayUpdated(previousGateway, blsGateway);
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

    function recover() public onlyGateway {
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
    ) public payable onlyEntryPoint thisNonce(op.nonce) returns (
        bool success,
        bytes[] memory results
    ) {
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
        incrementNonce(); // regardless of outcome of operation
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
                bytes memory indexByte = new bytes(1);
                indexByte[0] = bytes1(uint8(78)); // "N";
                if (i < 10) {
                    indexByte[0] = bytes1(uint8(48 + i)); // "0" - "9"
                }
                string memory message = string.concat(
                    string(indexByte),
                    " - ",
                    abi.decode(stripMethodId(result), (string)) // remove "Error" methodId, it gets added again on this throw
                );
                revert(message);
            }
            results[i] = result;
        }
    }

    function stripMethodId(bytes memory encodedFunction) pure private returns(bytes memory) {
        bytes memory params = new bytes(encodedFunction.length - 4);
        for (uint256 i=0; i<params.length; i++) {
            params[i] = encodedFunction[i+4];
        }
        return params;
    }

    function clearApprovedProxyAdminFunctionHash() public onlyGateway {
        approvedProxyAdminFunctionHash = 0;
    }

    /**
    Consecutive nonce increment, contract can be upgraded for other types
     */
    function incrementNonce() private {
        nonce++;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 requestId,
        address _aggregator,
        uint256 missingWalletFunds
    ) external view {
        require(_aggregator == aggregator);
        require(userOp.nonce == nonce);
        require(missingWalletFunds == 0);
    }

    function getAggregator() public view returns (address) {
        return aggregator;
    }

    modifier onlyThis() {
        require(msg.sender == address(this), "BLSWallet: only callable from this");
         _;
    }

    modifier onlyGateway() {
        bool isGateway =
            (msg.sender == blsGateway)
        ;
        require(isGateway, "BLSWallet: only callable from gateway");
         _;
    }

    modifier onlyEntryPoint() {
        require(
            msg.sender == entryPoint,
            "BLSWallet: only callable from 4337 entry point"
        );
        _;
    }

    modifier thisNonce(uint256 opNonce) {
        require(opNonce == nonce, "BLSWallet: only callable with current nonce");
        _;
    }
}
