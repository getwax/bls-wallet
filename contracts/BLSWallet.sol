//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

// Modified for solidity 0.8.0
import "./lib/BLS.sol"; //from hubble repo
import "./lib/IERC20.sol";

import "hardhat/console.sol";


contract BLSWallet //is IERC20 //(to consider?)
{
    IERC20 baseToken;

    mapping (address => uint256[4]) blsKeys;
    mapping (address => uint256) balances;

    constructor(IERC20 token) {
        baseToken = token;
    }

    function senderKeyExists() public pure returns (bool) {
    }

    /**
    Begin use of wallet by locking up tokens.
    @dev Called from token holder's address. Tokens pre-approved.
    @param blsPubKey BLS public key to be used with address
    @param amount Amount of tokens the wallet is to take
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

    /**
    Finish using wallet by returning balance and resetting key.
    @dev Called from token holder's address
    */
    function withdraw() public {
        uint256 amount = balances[msg.sender];
        blsKeys[msg.sender] = [0,0,0,0];
        balances[msg.sender] = 0;
        baseToken.transfer(msg.sender, amount);
    } 

    //   //TODO: verifyMultiple
    function transferBatch(
        uint256[2] memory signature,
        uint256[4][] memory pubkeys,
        uint256[2][] memory messages
    ) public view returns (bool checkResult, bool callSuccess) {
        //WIP
        return BLS.verifyMultiple(signature, pubkeys, messages);
    }

    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }

}
