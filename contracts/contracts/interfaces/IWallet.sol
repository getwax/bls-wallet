//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;

/** Interface for a contract wallet that can perform Operations
 */
interface IWallet {
    /** Aggregated signature with corresponding senders + operations */
    struct Bundle {
        uint256[2] signature;
        uint256[4][] senderPublicKeys;
        IWallet.Operation[] operations;
    }

    struct Operation {
        uint256 nonce;
        uint256 gas;
        IWallet.ActionData[] actions;
    }

    struct ActionData {
        uint256 ethValue;
        address contractAddress;
        bytes encodedFunction;
    }

    error ActionError(uint256 actionIndex, bytes errorData);

    function initialize(address gateway) external;
    function nonce() external returns (uint256);

    function performOperation(
        Operation calldata op
    ) external payable returns (
        bool success,
        bytes[] memory results
    );

    function recoveryHash() external returns (bytes32);
    function recover() external;

    // prepares gateway to be set (after pending timestamp)
    function setTrustedGateway(address gateway) external;
    // checks any pending variables and sets them if past their timestamp
    function setAnyPending() external;

    function setProxyAdminFunctionHash(bytes32) external;
    function approvedProxyAdminFunctionHash() external view returns (bytes32);
    function clearApprovedProxyAdminFunctionHash() external;
}
