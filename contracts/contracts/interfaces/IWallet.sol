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

    function initialize(address gateway) external;
    function nonce() external returns (uint256);

    function performOperation(
        Operation calldata op
    ) external payable returns (
        bool success,
        bytes[] memory results
    );
}

interface IBLSWallet is IWallet {
    // type BLSPublicKey is uint256[4]; // The underlying type for a user defined value type has to be an elementary value type.

    function latchBLSPublicKey(
        uint256[4] memory blsKey
    ) external;

 }
 