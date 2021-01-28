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

    bytes32 BLS_DOMAIN = keccak256(abi.encodePacked(uint32(0xfeedbee5)));
    uint256 constant BLS_LEN = 4;
    uint256[BLS_LEN] ZERO_BLS_SIG = [uint256(0), uint256(0), uint256(0), uint256(0)];

    mapping (address => uint256[BLS_LEN]) blsKeys;
    mapping (address => uint256) balances;
    // mapping (address => mapping (address => uint256)) private allowances;

    address functionSigner = address(0);

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
    ) public proxyFunction {
        balances[functionSigner] -= amount;
        balances[recipient] += amount;
    }

    //TODO (WIP): protect from replay (nonce, chainId).
    /**
    @dev The aggregator will have to be mindful of the order of transactions.
    eg Transfers from A->B, then B->C, may fail if reversed.
    Also submitting too many transfer txs will eventually reach the block gas limit.
    TODO: calculate approx tx limit.
     */
    function transferBatch(
        uint256[2] calldata signature,
        address[] calldata fromAccounts,
        uint256[2][] calldata messages,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyAggregator {
        string memory transferFn = "transfer(address,uint256)";

        uint256 txCount = fromAccounts.length;
        require(messages.length == txCount, "BLSWallet: account/message length mismatch.");
        require(recipients.length == txCount, "BLSWallet: recipient/message length mismatch.");
        require(amounts.length == txCount, "BLSWallet: amount/message length mismatch.");
        uint256[BLS_LEN][] memory pubKeys = new uint256[BLS_LEN][](txCount);
        uint256 successfulCalls = 0;
        for (uint256 i = 0; i<txCount; i++) {
            // Store blsKeys for verification
            pubKeys[i] = blsKeys[fromAccounts[i]];
            console.log(pubKeys[i][0]);

            // function to be called
            bytes memory encodedFunction = abi.encodeWithSignature(
                transferFn, recipients[i], amounts[i]
            );
            bytes32 encFuncHash = keccak256(encodedFunction); // hash signed for
            // bls points to compare
            uint256[2] memory msgPoint = BLS.hashToPoint(
                BLS_DOMAIN,
                abi.encodePacked(encFuncHash) //bytes32 to bytes
            );

            // call function if signed for by individual
            if (pointsMatch(messages[i], msgPoint)) {
                functionSigner = fromAccounts[i];
                (bool success, ) = address(this).call(encodedFunction);
                successfulCalls += (success ? 1 : 0);
            }
        }
        (bool checkResult, bool callSuccess) = BLS.verifyMultiple(signature, pubKeys, messages);
        require(callSuccess && checkResult, "BLSWallet: All sigs not verified");
    }

    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }

    function copyBLSKey(
        uint256[BLS_LEN] storage dest,
        uint256[BLS_LEN] memory source
    ) internal {
        for (uint256 i = 0; i<BLS_LEN; i++) {
            dest[i] = source[i];
        }
    }

    function pointsMatch(
        uint256[2] calldata a,
        uint256[2] memory b
    ) internal pure returns (bool result) {
        result = (a[0] == b[0]);
        result = result && (a[1] == b[1]);
    }
    modifier onlyAggregator() {
        require(msg.sender == aggregatorAddress);
        _;
    }

    /**
    @dev ProxyFunctions can be called directly (any msg.sender).
    For calls from the wallet, the functionSigner must be explicitly set beforehand.
    The functionSigner is then cleared after the proxied function.
     */
    modifier proxyFunction() {
        if (msg.sender == address(this)) {
            require(functionSigner != address(0), "BLSWallet: signer not set befor proxied call");
        }
        else {
            functionSigner = msg.sender;
        }
        _;
        // Don't leave current signer set after proxied function call
        functionSigner = address(0);
    }
}
