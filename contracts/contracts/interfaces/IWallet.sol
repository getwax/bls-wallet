//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;

import "./IVerificationGateway.sol";

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

    function initialize(IVerificationGateway gateway) external;
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
    function setTrustedGateway(IVerificationGateway gateway) external;
    // checks any pending variables and sets them if past their timestamp
    function setAnyPending() external;

    function setProxyAdminFunction(bytes memory) external;
    function approvedProxyAdminFunction() external view returns (bytes memory);
    function clearApprovedProxyAdminFunction() external;
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
 