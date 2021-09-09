// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import { BLS } from "./hubble-contracts/contracts/libs/BLS.sol";

library BLSOpen {
    function verifySingle(
        uint256[2] memory signature,
        uint256[4] memory pubkey,
        uint256[2] memory message
    ) external view returns (bool, bool) {
        return BLS.verifySingle(
            signature,
            pubkey,
            message
        );
    }

    function verifyMultiple(
        uint256[2] memory signature,
        uint256[4][] memory pubkeys,
        uint256[2][] memory messages
    ) external view returns (bool checkResult, bool callSuccess) {
        return BLS.verifyMultiple(
            signature,
            pubkeys,
            messages
        );
    }

    function hashToPoint(bytes32 domain, bytes memory message)
        external
        view
        returns (uint256[2] memory) {
            return BLS.hashToPoint(
                domain,
                message
            );
        }

}
