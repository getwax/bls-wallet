//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.15;

import "./VLQ.sol";

/**
 * Registry Index
 * 
 * This is just two fixed bytes followed by VLQ.
 *
 * This format has a 3-byte minimum size with the following advantages over VLQ:
 * - Provides 4x the number of indexes at each width.
 * - Avoids negative perception caused by the exclusivity of 1 and 2 byte
 *   indexes.
 * - Allows us to say 'we use 3 bytes' as a reasonable approximation, since this
 *   will be true for a long time. If asked, we can explain how this gracefully
 *   expands to additional bytes as they become needed.
 */
library RegIndex {
    function decode(
        bytes calldata stream
    ) internal pure returns (uint256, bytes calldata) {
        uint256 fixedValue = uint8(stream[0]) + (uint8(stream[1]) << 8);

        uint256 vlqValue;
        (vlqValue, stream) = VLQ.decode(stream[2:]);

        uint256 fullValue = fixedValue + (vlqValue << 16);

        return (fullValue, stream);
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
