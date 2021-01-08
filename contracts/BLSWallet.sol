//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "./lib/BLS.sol";
import "./lib/IERC20.sol";
import "hardhat/console.sol";


contract BLSWallet //is IERC20 //(to consider?)
{
  IERC20 baseToken;

  mapping (address => uint256[4])public blsKeys;
  mapping (address => uint256) balances;

  constructor(IERC20 token) {
    baseToken = token;
  }

  /**
  @dev Called from token holder's address
   */
  function deposit(
    uint256[4] memory blsPubKey,
    uint256 amount
  ) public {
    // TODO: check existing key
    baseToken.transferFrom(msg.sender, address(this), amount);
    blsKeys[msg.sender] = blsPubKey;
    balances[msg.sender] += amount;
  }

  function withdraw() public {
    uint256 amount = balances[msg.sender];
    blsKeys[msg.sender] = [0,0,0,0];
    balances[msg.sender] = 0;
    baseToken.transfer(msg.sender, amount);
  }

  //   //TODO: verifyMultiple
  // function transferBatch() {}

  function balanceOf(address account) public view returns (uint256) {
    return balances[account];
  }

}
