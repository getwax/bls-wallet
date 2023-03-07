//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

contract BLSPublicKeyRegistry {
    mapping(uint256 => uint256[4]) public blsPublicKeys;
    uint public nextId = 0;

    event BLSPublicKeyRegistered(uint256 id, uint256[4] indexed blsPublicKey);

    function register(uint256[4] memory blsPublicKey) external {
        uint256 id = nextId;
        nextId += 1;
        blsPublicKeys[id] = blsPublicKey;

        emit BLSPublicKeyRegistered(id, blsPublicKey);
    }
}
