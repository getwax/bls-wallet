//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./IWallet.sol";

interface IExpander {
    function expand(bytes calldata input) external returns (
        uint256[4][] memory senderPublicKeys,
        IWallet.Operation[] memory operations,
        uint256 bytesRead
    );
}
