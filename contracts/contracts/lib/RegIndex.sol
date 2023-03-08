//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.15;

/**
 * Registry Index
 * 
 * This is just two fixed bytes followed by VLQ.
 * 
 * This format has a 3-byte minimum and allows for >8m indexes at 3 bytes. Exact
 * values are:
 * - 3 bytes: 2^23        =       8,388,608 indexes
 * - 4 bytes: 2^30 - 2^23 =   1,065,353,216 indexes
 * - 5 bytes: 2^37 - 2^30 = 136,365,211,648 indexes
 * (In theory, this goes all the way to uint256max, which uses 37 bytes.)
 *
 * This format has following advantages over VLQ:
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
        uint256 value = (
            (uint256(uint8(stream[0])) << 15) +
            (uint256(uint8(stream[1])) << 7)
        );

        // Note: This is now basically the VLQ code inlined into here. We could
        // just call VLQ.decode(), but making that BigEndian is trickier than
        // just inlining a modified version. (The first two bytes need to be
        // shifted up depending on how long the VLQ is, and VLQ.decode doesn't
        // tell us that directly.)

        uint256 bytesRead = 2;

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
