// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

import "hardhat/console.sol";

contract MockAuction {

    function buyItNow() public payable {
        require(msg.value > 0, "Has Value");
    }

}
