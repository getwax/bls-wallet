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

    struct AuthKey {
        bytes32 id;
        uint256 delay;
    }

    struct AuthValue {
        bytes32 data;
        uint256 validFrom;
    }

    function initialize(address gateway) external;
    function nonce() external returns (uint256);

    function performOperation(
        Operation calldata op
    ) external payable returns (
        bool success,
        bytes[] memory results
    );

    // prepares gateway to be set (after pending timestamp)
    function setTrustedGateway(address gateway) external;

    function authorize(
        AuthKey memory key,
        bytes32 data
    ) external;

    function deauthorize(AuthKey memory key) external;

    function consumeAuthorization(
        AuthKey memory key,
        bytes32 data
    ) external;
}
