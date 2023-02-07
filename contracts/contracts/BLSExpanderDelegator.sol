//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./VLQ.sol";
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

    mapping(uint256 => IExpander) public expanders;
    uint256 public expanderCount = 0;

    IBundleProcessor gateway;

    constructor(IBundleProcessor gatewayParam) {
        gateway = gatewayParam;
    }

    function run(bytes calldata input) external returns (
        bool[] memory successes,
        bytes[][] memory results
    ) {
        IWallet.Bundle memory bundle;

        (uint256 bundleLen, uint256 bundleLenBytesRead) = VLQ.decode(input);
        bundle.senderPublicKeys = new uint256[BLS_KEY_LEN][](bundleLen);
        bundle.operations = new IWallet.Operation[](bundleLen);

        uint256 opsByteLen = input.length - 64;
        bundle.signature = abi.decode(input[opsByteLen:], (uint256[2]));

        uint256 inputPos = bundleLenBytesRead;
        uint256 opsDecoded = 0;

        while (inputPos < opsByteLen) {
            (uint256 expanderIndex, uint256 vlqBytesRead) = VLQ.decode(
                input[inputPos:]
            );

            inputPos += vlqBytesRead;

            IExpander expander = expanders[expanderIndex];

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

        return gateway.processBundle(bundle);
    }

    function registerExpander(IExpander expander) external {
        expanders[expanderCount] = expander;
        expanderCount++;
    }
}
