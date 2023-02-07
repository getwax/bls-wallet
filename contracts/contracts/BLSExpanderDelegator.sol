//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

contract BLSExpanderDelegator {
    mapping(uint256 => address) public expanders;
    uint256 public expanderCount = 0;

    // Potential to use fallback() instead to save 4 bytes
    function run(bytes calldata input) external {
        // Loop until all bytes consumed:
        //   Read VLQ
        //   Delegate to specialized expander
        //   Accumulate operations
        // Call VerificationGateway
    }

    function registerExpander(address expander) external {
        expanders[expanderCount] = expander;
        expanderCount++;
    }
}
