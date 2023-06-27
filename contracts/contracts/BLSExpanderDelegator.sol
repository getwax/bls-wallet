//SPDX-License-Identifier: MIT
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

    uint256 public nextExpanderId = 0;
    mapping(uint256 => IExpander) public expanders;
    event ExpanderRegistered(uint256 id, IExpander indexed expanderAddress);

    constructor(IBundleProcessor gatewayParam) {
        gateway = gatewayParam;
    }

    function run(bytes calldata stream) external returns (
        bool[] memory successes,
        bytes[][] memory results
    ) {
        IWallet.Bundle memory bundle;

        // The signature is just the last 64 bytes.
        uint256 opsByteLen = stream.length - 64;
        bundle.signature = abi.decode(stream[opsByteLen:], (uint256[2]));
        stream = stream[:opsByteLen]; // Only keep what we still need

        uint256 vlqValue;

        // Get the number of operations upfront so that we can allocate the
        // memory. This information is technically redundant but extracting it
        // by decoding everything before we have a place to put it would add a
        // lot of complexity. For <=127 operations it's only one extra byte.
        // Otherwise 2 bytes.
        (vlqValue, stream) = VLQ.decode(stream);

        bundle.senderPublicKeys = new uint256[BLS_KEY_LEN][](vlqValue);
        bundle.operations = new IWallet.Operation[](vlqValue);

        uint256 opsDecoded = 0;

        while (stream.length > 0) {
            // First figure out which expander to use.
            (vlqValue, stream) = VLQ.decode(stream);
            IExpander expander = expanders[vlqValue];
            require(expander != IExpander(address(0)), "expander not found");

            // Then use it to expand the operation.
            (
                uint256[BLS_KEY_LEN] memory senderPublicKey,
                IWallet.Operation memory operation,
                uint256 expanderBytesRead
            ) = expander.expand(stream);

            // It would be more consistent to have .expand above return the new
            // stream, but there appears to be a bug in solidity that prevents
            // this.
            stream = stream[expanderBytesRead:];

            bundle.senderPublicKeys[opsDecoded] = senderPublicKey;
            bundle.operations[opsDecoded] = operation;

            opsDecoded++;
        }

        // Finished expanding. Now just return the call.
        return gateway.processBundle(bundle);
    }

    function registerExpander(
        IExpander expander
    ) external {
        uint256 expanderId = nextExpanderId;
        nextExpanderId += 1;
        expanders[expanderId] = expander;

        emit ExpanderRegistered(expanderId, expander);
    }
}
