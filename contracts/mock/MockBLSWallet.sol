// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../BLSWallet.sol";

contract MockBLSWallet is BLSWallet {
    constructor(
        IERC20 token
    ) BLSWallet(token) {
        
    }

    function blsPubKeyOf(
        address account
    ) public view returns (uint256[4] memory) {
        return blsKeys[account];
    }
}
