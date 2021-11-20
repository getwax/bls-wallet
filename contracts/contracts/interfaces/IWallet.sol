//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;

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

    function initialize(address walletGateway) external;
    function latchPublicKey(
        uint256[4] memory blsKey
    ) external;

    function nonce() external returns (uint256);
    function performOperation(
        Operation calldata op
    ) external returns (
        bool success,
        bytes[] memory results
    );
}
