//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

contract BLSPublicKeyRegistry {
    mapping(uint256 => uint256[4]) public blsPublicKeys;
    uint256 public nextId = 0;

    event BLSPublicKeyRegistered(uint256 id, bytes32 indexed blsPublicKeyHash);

    function register(uint256[4] memory blsPublicKey) external {
        uint256 id = nextId;
        nextId += 1;
        blsPublicKeys[id] = blsPublicKey;

        emit BLSPublicKeyRegistered(id, keccak256(abi.encode(blsPublicKey)));
    }

    function lookup(uint256 id) external view returns (uint256[4] memory) {
        uint256[4] memory blsPublicKey = blsPublicKeys[id];
        require(!isZeroBLSPublicKey(blsPublicKey), "BLSPublicKeyRegistry: BLS public key not found");

        return blsPublicKey;
    }

    function isZeroBLSPublicKey(uint256[4] memory blsPublicKey) internal pure returns (bool) {
        for (uint i = 0; i < 4; i++) {
            if (blsPublicKey[i] != 0) {
                return false;
            }
        }

        return true;
    }
}
