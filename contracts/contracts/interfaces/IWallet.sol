//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;

/** Interface for a contract wallet that can perform Operations
 */
interface IWallet {
    struct Operation {
        uint256 nonce;
        IWallet.ActionData[] actions;
    }

    struct ActionData {
        uint256 ethValue;
        address contractAddress;
        bytes encodedFunction;
    }

    function initialize(
        uint256[4] memory _blsKey,
        address _blsGateway,
        address _entryPoint,
        address _aggregator
    ) external;

    function getBlsKey() external returns (uint256[4] memory);
    function setBlsKey(uint256[4] memory newBlsKey) external;
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
