//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./lib/VLQ.sol";
import "./interfaces/IWallet.sol";
import "./interfaces/IExpander.sol";

// Aka gateway, but we only care about processBundle here
interface IBundleProcessor {
    function processBundle(
        IWallet.Bundle memory bundle
    ) external returns (
        bool[] memory successes,
        bytes[][] memory results
    );
}

contract BLSExpanderDelegator {
    uint8 constant BLS_KEY_LEN = 4;

    IBundleProcessor gateway;
    mapping(uint256 => IExpander) public expanders;

    constructor(IBundleProcessor gatewayParam) {
        gateway = gatewayParam;
    }

    function run(bytes calldata input) external returns (
        bool[] memory successes,
        bytes[][] memory results
    ) {
        IWallet.Bundle memory bundle;

        // Get the number of operations upfront so that we can allocate the
        // memory. This information is technically redundant but extracting it
        // by decoding everything before we have a place to put it would add a
        // lot of complexity. For <=127 operations it's only one extra byte.
        // Otherwise 2 bytes.
        (uint256 opsLen, uint256 opsLenBytesRead) = VLQ.decode(input);
        bundle.senderPublicKeys = new uint256[BLS_KEY_LEN][](opsLen);
        bundle.operations = new IWallet.Operation[](opsLen);

        // The signature is just the last 64 bytes.
        uint256 opsByteLen = input.length - 64;
        bundle.signature = abi.decode(input[opsByteLen:], (uint256[2]));

        // Solidity/EVM doesn't provide an abstraction for a stateful reader of
        // bytes. To implement this, we keep track of where we're up to in the
        // input and increment it as we read things.
        uint256 inputPos = opsLenBytesRead;
        uint256 opsDecoded = 0;

        while (inputPos < opsByteLen) {
            // First figure out which expander to use.
            (uint256 expanderIndex, uint256 vlqBytesRead) = VLQ.decode(
                input[inputPos:]
            );

            inputPos += vlqBytesRead;

            IExpander expander = expanders[expanderIndex];

            // Then use it to expand operations (usually just 1).
            (
                uint256[BLS_KEY_LEN][] memory senderPublicKeys,
                IWallet.Operation[] memory operations,
                uint256 expanderBytesRead
            ) = expander.expand(input[inputPos:]);

            inputPos += expanderBytesRead;

            require(
                senderPublicKeys.length == operations.length,
                "keys vs ops length mismatch"
            );

            for (uint256 i = 0; i < operations.length; i++) {
                bundle.senderPublicKeys[opsDecoded + i] = senderPublicKeys[i];
                bundle.operations[opsDecoded + i] = operations[i];
            }

            opsDecoded += operations.length;
        }

        // Finished expanding. Now just return the call.
        return gateway.processBundle(bundle);
    }

    function registerExpander(
        uint256 expanderIndex,
        IExpander expander
    ) external {
        require(
            expanders[expanderIndex] == IExpander(address(0)),
            "Index not available"
        );

        expanders[expanderIndex] = expander;
    }
}
