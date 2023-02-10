//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./VLQ.sol";

/**
 * Like a float, but technically for integers. Also base 10.
 *
 * The pseudo-float is an encoding that can represent any uint256 value but
 * efficiently represents values with a small number of significant figures
 * (just 2 bytes for 3 significant figures).
 *
 * Zero is a special case, it's just 0x00.
 *
 * Otherwise, start with the value in scientific notation:
 *
 *     1.23 * 10^16 (e.g. 0.0123 ETH)
 *
 * Make the mantissa (1.23) a whole number by adjusting the exponent:
 *
 *     123 * 10^14
 *
 * We add 1 to the exponent and encode it in 5 bits:
 *
 *     11111 (=15)
 *
 *     (The maximum exponent is 30. Adjust the left side of the previous
 *     equation if needed.)
 *
 * Encode the left side in binary:
 *
 *     1111011 (=123)
 *
 * Our first byte is the 5-bit exponent followed by the three lowest bits of the
 * mantissa:
 * 
 *     11111011
 *     ^^^^^-------- 15 => exponent is 14
 *          ^^^----- lowest 3 bits of the mantissa
 *
 * Encode the remaining bits of the mantissa as a VLQ:
 *
 *     00001111
 *     ^------------ special VLQ bit, zero indicates this is the last byte
 *      ^^^^^^^----- bits to use, put them together with 011 above to get
 *                   0001111011, which is 123.
 *
 * Example 2:
 * 
 *     0.883887085 ETH uses 5 bytes: 0x55b4d7c27d
 *     883887085 * 10^9
 *     For exponent 9 we encode 10 as 5 bits: 01010
 *     883887085 is 110100101011110000101111101(101)
 *
 *     01010101 10110100 11010111 11000010 01111101
 *     ^^^^^------------------------------------------- 10 => exponent is 9
 *          ^^^---------------------------------------- lowest 3 bits
 *               ^^^^^^^--^^^^^^^--^^^^^^^--^^^^^^^     higher bits
 *              ^--------^--------^-------------------- 1 => not the last byte
 *                                         ^----------- 0 => the last byte
 *
 * Note that the *encode* process is described above for explanatory purposes.
 * On-chain we need to *decode* to recover the value from the encoded binary
 * instead.
 */
library PseudoFloat {
    function decode(
        bytes calldata stream
    ) internal pure returns (uint256, bytes calldata) {
        uint8 firstByte = uint8(stream[0]);

        if (firstByte == 0) {
            return (0, stream[1:]);
        }

        uint8 exponent = ((firstByte & 0xf8) >> 3) - 1;

        uint256 value;
        (value, stream) = VLQ.decode(stream);

        value <<= 3;
        value += firstByte & 0x03;

        // TODO (merge-ok): Exponentiation by squaring might be better here.
        // Counterpoints:
        // - The gas used is pretty low anyway
        // - For these low exponents (typically ~15), the benefit is unclear
        for (uint256 i = 0; i < exponent; i++) {
            value *= 10;
        }

        return (value, stream);
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
