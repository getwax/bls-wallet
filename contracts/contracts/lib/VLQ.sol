//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

/**
 * Variable Length Quantity
 * 
 * An unsigned integer format that provides an efficient representation of small
 * values while allowing for unlimited size (except for the 256bit limit in this
 * context).
 * 
 * The first (highest) bit of each byte indicates whether to continue reading.
 * The other 7 bits are used as a big-endian representation of the number.
 * 
 * Examples
 * 
 * 0x00: 0
 * 0x01: 1
 * 0x7f: 127
 * 0x8100: 128
 * 0x8105: 133 = 1 * 128 + 5
 * 0x838005: 49,157 = 3 * 128^2 + 0 * 128^1 + 5 * 128^0
 * 
 * https://en.wikipedia.org/wiki/Variable-length_quantity
 */
library VLQ {
    function decode(
        bytes calldata stream
    ) internal pure returns (uint256, bytes calldata) {
        uint256 value = 0;
        uint256 bytesRead = 0;

        while (true) {
            uint8 currentByte = uint8(stream[bytesRead++]);

            // Add the lowest 7 bits to the value
            value += currentByte & 0x7f;

            // If the highest bit is zero, stop
            if (currentByte & 0x80 == 0) {
                break;
            }

            // We're continuing. Shift the value 7 bits to the left (higher) to
            // make room.
            value <<= 7;
        }

        return (value, stream[bytesRead:]);
    }

    /**
     * Same as decode, but public.
     * 
     * This is here because when a library function that is not internal
     * requires linking when used in other contracts. This avoids including a
     * copy of that function in the contract but it's complexity that we don't
     * want right now.
     * 
     * What we do want though, is a public version so that we can call it
     * statically for testing.
     */
    function decodePublic(
        bytes calldata stream
    ) public pure returns (uint256, bytes calldata) {
        return decode(stream);
    }
}
