//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "hardhat/console.sol";

contract BLSExpanderDelegator {
    mapping(uint256 => address) public expanders;
    uint256 public expanderCount = 0;

    function run(bytes calldata input) external view {
        uint256 len = input.length;
        uint256 pos = 0;

        while (pos < len) {
            (uint256 expanderIndex, uint256 bytesRead) = readVLQ(input[pos:]);
            pos += bytesRead;

            console.log("expanderIndex", expanderIndex);
        }

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

    function readVLQ(bytes calldata data) internal pure returns (
        uint256 result,
        uint256 bytesRead
    ) {
        uint256 multiplier = 1;

        while (true) {
            uint8 currentByte = uint8(data[bytesRead++]);
            result += multiplier * (currentByte & 127);

            if (currentByte & 128 == 0) {
                break;
            }

            multiplier <<= 7;
        }
    }
}
