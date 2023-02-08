//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./lib/VLQ.sol";
import "./interfaces/IExpander.sol";
import "./interfaces/IWallet.sol";

/**
 * An expander that supports any operation.
 *
 * This is still a more compact encoding due to the use of VLQ and general byte
 * packing in several places where the solidity abi would just use a 32-byte
 * word.
 *
 * Example:
 *
 * 0x
 * 2409925687d52a67b435a011cf9ec82d390300cd12e5842d2a0c5e1c27898551 // BLS key
 * 0c4a8cbcc96cada40301e1d2a2d68425b5cf0e18f5cb12fa272f841017c36776 // BLS key
 * 27b9f42b237d75bcb0473e2eada290e62ec77048187484f8952fffe0239f7ba9 // BLS key
 * 24f1fc8a1f7256dc2914e524966309df2226fd329373aaaae1881bf5cd0c62f4 // BLS key
 *
 * 00 // nonce: 0
 * 868d20 // gas: 100,000
 * 02 // two actions
 *
 * // Action 1
 * 95ecd98ed5f38000 // ethValue: 12300000000000000 (0.0123 ETH)
 * 70997970c51812dc3a010c7d01b50e0d17dc79c8 // contractAddress
 * 00 // encodedFunction: (empty)
 *
 * // Action 2
 * 82dd9fbdf38000 // ethValue: 12000000000000 (0.000012 ETH)
 * 4bd2e4e99b50a2a9e6b9dabfa3c8dcd1f885f008 // contractAddress (AggUtils)
 * 04 // 4 bytes for encodedFunction
 * 1dfea6a0 // sendEthToTxOrigin
 *
 * The proposal doc for the new expander lists the same example ("Example of an
 * Expanded User Operation" https://hackmd.io/0q7H3Ad0Su-I4RWWK8wQPA) using the
 * solidity ABI, which uses 608 bytes. Here we've encoded the same thing (plus
 * gas) in 194 bytes, which is (about) 70% smaller. (If you account for the
 * zero-byte discount, the saving is still over 30%.)
 */
contract FallbackExpander is IExpander {
    function expand(bytes calldata input) external pure returns (
        uint256[4][] memory senderPublicKeys,
        IWallet.Operation[] memory operations,
        uint256 bytesRead
    ) {
        senderPublicKeys = new uint256[4][](1);
        operations = new IWallet.Operation[](1);

        senderPublicKeys[0] = abi.decode(input[0:128], (uint256[4]));

        bytesRead = 128;

        (uint256 nonce, uint256 nonceBytesRead) = VLQ.decode(input[bytesRead:]);
        bytesRead += nonceBytesRead;
        operations[0].nonce = nonce;

        (uint256 gas, uint256 gasBytesRead) = VLQ.decode(input[bytesRead:]);
        bytesRead += gasBytesRead;
        operations[0].gas = gas;

        (uint256 actionLen, uint256 actionLenBytesRead) = VLQ.decode(input[bytesRead:]);
        bytesRead += actionLenBytesRead;
        operations[0].actions = new IWallet.ActionData[](actionLen);

        for (uint256 i = 0; i < actionLen; i++) {
            (uint256 ethValue, uint256 ethValueBytesRead) = VLQ.decode(input[bytesRead:]);
            bytesRead += ethValueBytesRead;

            address contractAddress = abi.decode(input[bytesRead:bytesRead+20], (address));
            bytesRead += 20;

            (uint256 fnLen, uint256 fnLenBytesRead) = VLQ.decode(input[bytesRead:]);
            bytesRead += fnLenBytesRead;

            bytes memory encodedFunction = input[bytesRead:bytesRead+fnLen];
            bytesRead += fnLen;

            operations[0].actions[i] = IWallet.ActionData({
                ethValue: ethValue,
                contractAddress: contractAddress,
                encodedFunction: encodedFunction
            });
        }
    }
}
