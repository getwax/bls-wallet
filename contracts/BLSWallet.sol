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
    address aggregatorAddress;
    uint256 constant BLS_LEN = 4;
    uint256[BLS_LEN] ZERO_BLS_SIG = [uint256(0), uint256(0), uint256(0), uint256(0)];

    mapping (address => uint256[BLS_LEN]) blsKeys;
    mapping (address => uint256) balances;
    // mapping (address => mapping (address => uint256)) private allowances;

    //TODO: only allow approved function signatures
    mapping (bytes32 => bool) approvedFunctions;

    event DepositReceived(
        uint256 amount,
        address indexed account,
        uint256[BLS_LEN] pubkey
    );
    event WithdrawSent(
        uint256 amount,
        address indexed account
    );

    constructor(address aggregator, IERC20 token) {
        aggregatorAddress = aggregator;
        baseToken = token;
        // approvedFunctions[keccak("transfer(address,amount)")];
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


    function transfer (
        address recipient,
        uint256 amount
    ) public {
        transferFromSigner(
            msg.sender,
            recipient,
            amount
        );
    }

    function transferFromSigner (
        address signer,
        address recipient,
        uint256 amount
    ) private onlyAggregatorOrSigner(signer) {
        // console.log("BEFORE", balances[signer], balances[recipient]);
        balances[signer] -= amount;
        balances[recipient] += amount;
        // console.log(" AFTER", balances[signer], balances[recipient]);
    }

    event Data(string info, uint256[2] value);

    //TODO: verify messages (WIP)
    function transferBatch(
        uint256[2] memory signature,
        address[] memory fromAccounts,
        uint256[2][] memory messages,
        address[] memory recipients,
        uint256[] memory amounts
    ) public onlyAggregator {
        uint256 txCount = fromAccounts.length;
        require(messages.length == txCount, "BLSWallet: account/message length mismatch.");
        uint256[BLS_LEN][] memory pubKeys = new uint256[BLS_LEN][](txCount);
        for (uint256 i = 0; i<txCount; i++) {
            //TODO: check messages param (message points) is from
            // desired message (hash of encoded functionSig+params)
            //INFO
            emit Data("point params", messages[i]);
            bytes memory encodedFunction = abi.encodeWithSignature(
                "transfer(address,uint256)", recipients[i], amounts[i]
            );
            bytes32 encFuncHash = keccak256(encodedFunction);
            emit Data(
                "contract call:",
                [uint256(encFuncHash), uint256(0)]
            );
            // (bool success, bytes memory data) = address(this).call(encodedFunction);
            //\INFO
            pubKeys[i] = blsKeys[fromAccounts[i]];
            transferFromSigner(fromAccounts[i], recipients[i], amounts[i]);
        }
        (bool checkResult, bool callSuccess) = BLS.verifyMultiple(signature, pubKeys, messages);
        require(callSuccess && checkResult, "BLSWallet: All sigs not verified");
    }

    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }

    function copyBLSKey(uint256[BLS_LEN] storage dest, uint256[BLS_LEN] memory source) internal {
        for (uint256 i = 0; i<BLS_LEN; i++) {
            dest[i] = source[i];
        }
    }

    modifier onlyAggregator() {
        require(msg.sender == aggregatorAddress);
        _;
    }

    modifier onlyAggregatorOrSigner(address signer) {
        require(
            (msg.sender == aggregatorAddress) ||
            (msg.sender == signer)
        );
        _;
    }
}
