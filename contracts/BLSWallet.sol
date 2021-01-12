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
    uint256 constant BLS_LEN = 4;
    uint256[BLS_LEN] ZERO_BLS_SIG = [uint256(0), uint256(0), uint256(0), uint256(0)];

    mapping (address => uint256[BLS_LEN]) blsKeys;
    mapping (address => uint256) balances;

    event DepositReceived(
        uint256 amount,
        address indexed account,
        uint256[BLS_LEN] pubkey
    );
    event WithdrawSent(
        uint256 amount,
        address indexed account
    );

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
        emit DepositReceived(amount, msg.sender, blsPubKey);
    }

    /**
    Finish using wallet by returning balance and resetting key.
    @dev Called from token holder's address
    */
    function withdraw() public {
        uint256 amount = balances[msg.sender];
        copyBLSKey(blsKeys[msg.sender], ZERO_BLS_SIG);
        balances[msg.sender] = 0;
        baseToken.transfer(msg.sender, amount);
        emit WithdrawSent(amount, msg.sender);
    } 

    //TODO: messages (WIP)
    function transferBatch(
        uint256[2] memory signature,
        address[] memory fromAccounts,
        uint256[2][] memory messages
    ) public view returns (bool checkResult, bool callSuccess) {
        uint256 txCount = fromAccounts.length;
        require(messages.length == txCount, "BLSWallet: account/message length mismatch.");
        uint256[BLS_LEN][] memory pubKeys = new uint256[BLS_LEN][](txCount);
        for (uint256 i = 0; i<txCount; i++) {
            pubKeys[i] = blsKeys[fromAccounts[i]];
        }

        return BLS.verifyMultiple(signature, pubKeys, messages);
    }

    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }

    function copyBLSKey(uint256[BLS_LEN] storage dest, uint256[BLS_LEN] memory source) internal {
        for (uint256 i = 0; i<BLS_LEN; i++) {
            dest[i] = source[i];
        }
    }

}
