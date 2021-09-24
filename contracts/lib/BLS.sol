// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import {
    BNPairingPrecompileCostEstimator
} from "./hubble-contracts/contracts/libs/BNPairingPrecompileCostEstimator.sol";

import { BLS } from "./hubble-contracts/contracts/libs/BLS.sol";

library BLSOpen {
    function verifySingle(
        uint256[2] memory signature,
        uint256[4] memory pubkey,
        uint256[2] memory message
    ) external view returns (bool, uint256) {
        uint256 gasCost = BNPairingPrecompileCostEstimator(0x5FbDB2315678afecb367f032d93F642f64180aa3).getGasCost(2);

        // NB: (result, success) opposite of `call` convention (success, result).
        (bool verified, bool callSuccess) = BLS.verifySingle(
            signature,
            pubkey,
            message
        );
        return (callSuccess && verified, gasCost);
    }

    function verifyMultiple(
        uint256[2] memory signature,
        uint256[4][] memory pubkeys,
        uint256[2][] memory messages
    ) external view returns (bool) {
        (bool verified, bool callSuccess) =  BLS.verifyMultiple(
            signature,
            pubkeys,
            messages
        );
        return callSuccess && verified;
    }

    function hashToPoint(
        bytes32 domain,
        bytes memory message
    ) external view returns (uint256[2] memory) {
        return BLS.hashToPoint(
            domain,
            message
        );
    }

}
