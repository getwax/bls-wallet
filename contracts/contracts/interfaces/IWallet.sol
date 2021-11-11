//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;

interface IWallet {

    struct ActionData {
        uint256 ethValue;
        address contractAddress;
        bytes encodedFunction;
    }

    function initialize(address walletGateway) external;
    function latchPublicKey(
        uint256[4] memory blsKey
    ) external;

    function nonce() external returns (uint256);
    function executeActions(
        ActionData[] calldata actions,
        bool atomic
    ) external returns (bool[] memory successes, bytes[] memory results);
}
