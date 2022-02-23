// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

contract Create2Deployer {
    event Deployed(address sender, uint256 salt, address addr);

    function addressFrom(
        address sender,
        uint256 salt,
        bytes calldata code
    ) public pure returns (
        address predictedAddress
    ) {
        predictedAddress = address(uint160(uint(keccak256(abi.encodePacked(
            bytes1(0xff),
            sender,
            salt,
            keccak256(code)
        )))));
    }

    function deploy(
        uint256 salt,
        bytes memory code
    ) public {
        address addr;
        assembly {
            addr := create2(0, add(code, 0x20), mload(code), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        emit Deployed(msg.sender, salt, addr);
    }

}
