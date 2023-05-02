//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

interface IExpanderDelegator {
    function run(
        bytes calldata stream
    ) external returns (bool[] memory successes, bytes[][] memory results);
}

contract ExpanderEntryPoint {
    IExpanderDelegator expanderDelegator;

    constructor(IExpanderDelegator expanderDelegatorParam) {
        expanderDelegator = expanderDelegatorParam;
    }

    fallback(bytes calldata stream) external returns (bytes memory) {
        (bool[] memory successes, bytes[][] memory results) = expanderDelegator
            .run{ gas: type(uint256).max }(stream);

        return abi.encode(successes, results);
    }
}
