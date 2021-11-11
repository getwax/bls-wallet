//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;

interface IWallet {
    function nonce() external returns (uint256);
    function executeActions() external;
}
