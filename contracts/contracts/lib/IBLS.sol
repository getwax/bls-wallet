// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;


interface IBLS {
    function verifySingle(
        uint256[2] memory signature,
        uint256[4] memory pubkey,
        uint256[2] memory message
    ) external view returns (bool);

    function verifyMultiple(
        uint256[2] memory signature,
        uint256[4][] memory pubkeys,
        uint256[2][] memory messages
    ) external view returns (bool);

    function hashToPoint(
        bytes32 domain,
        bytes memory message
    ) external view returns (uint256[2] memory);

}
