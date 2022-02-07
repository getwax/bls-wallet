//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
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

    function initialize(address gateway) external;
    function nonce() external returns (uint256);

    function performOperation(
        Operation calldata op
    ) external payable returns (
        bool success,
        bytes[] memory results
    );

    function recoveryHash() external returns (bytes32);
    function recover(uint256[4] calldata newBLSKey) external;

    // prepares gateway to be set (after pending timestamp)
    function setTrustedGateway(address gateway) external;
    // checks any pending variables and sets them if past their timestamp
    function setAnyPending() external;

    function setProxyAdminFunctionHash(bytes32) external;
    function approvedProxyAdminFunctionHash() external view returns (bytes32);
    function clearApprovedProxyAdminFunctionHash() external;
}

/** Interface for bls-specific functions
 */
interface IBLSWallet is IWallet {
    // type BLSPublicKey is uint256[4]; // The underlying type for a user defined value type has to be an elementary value type.

    function latchBLSPublicKey(
        uint256[4] memory blsKey
    ) external;

    function getBLSPublicKey() external view returns (uint256[4] memory);
 }
 