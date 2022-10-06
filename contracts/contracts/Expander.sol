//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import "@account-abstraction/contracts/interfaces/IAggregator.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/interfaces/UserOperation.sol";
// (See https://github.com/eth-infinitism/account-abstraction/tree/develop/contracts/interfaces)

contract Expander {
    uint constant ARBITRARY_GAS_LIMIT = 1000000000;

    // (Needs real deployed address)
    IEntryPoint constant ENTRY_POINT = IEntryPoint(
        0x0001020304050607080910111213141516171819
    );

    // (Needs real deployed address)
    IAggregator constant AGGREGATE_SIG_VALIDATOR = IAggregator(
        0x0001020304050607080910111213141516171819
    );

    struct SmallUserOperation {
        address sender;
        uint256 nonce;
        bytes callData;
    }

    function handleAggregatedOps(
        SmallUserOperation[] calldata smallUserOps,
        bytes calldata signature
    ) public {
        IEntryPoint.UserOpsPerAggregator[] memory opsPerAggregator =
            new IEntryPoint.UserOpsPerAggregator[](1);

        uint len = smallUserOps.length;

        UserOperation[] memory userOps = new UserOperation[](len);

        for (uint i = 0; i < len; i++) {
            userOps[i].sender = smallUserOps[i].sender;
            userOps[i].nonce = smallUserOps[i].nonce;
            // Leaving .initCode as empty
            userOps[i].callData = smallUserOps[i].callData;
            userOps[i].callGasLimit = ARBITRARY_GAS_LIMIT;
            userOps[i].verificationGasLimit = ARBITRARY_GAS_LIMIT;
            // Leaving .preVerificationGas as zero
            // Leaving .maxFeePerGas as zero
            // Leaving .maxPriorityFeePerGas as zero
            // Leaving .paymasterAndData as empty
            // Leaving .signature as empty
        }

        opsPerAggregator[0] = IEntryPoint.UserOpsPerAggregator(
            userOps,
            AGGREGATE_SIG_VALIDATOR,
            signature
        );

        ENTRY_POINT.handleAggregatedOps(
            opsPerAggregator,
            payable(msg.sender)
        );
    }
}
