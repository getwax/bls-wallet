//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./lib/VLQ.sol";
import "./interfaces/IExpander.sol";
import "./interfaces/IWallet.sol";

contract FallbackExpander is IExpander {
    function expand(bytes calldata input) external pure returns (
        uint256[4][] memory senderPublicKeys,
        IWallet.Operation[] memory operations,
        uint256 bytesRead
    ) {
        senderPublicKeys = new uint256[4][](1);
        operations = new IWallet.Operation[](1);

        senderPublicKeys[0] = abi.decode(input[0:128], (uint256[4]));

        bytesRead = 128;

        (uint256 nonce, uint256 nonceBytesRead) = VLQ.decode(input[bytesRead:]);
        bytesRead += nonceBytesRead;
        operations[0].nonce = nonce;

        (uint256 actionLen, uint256 actionLenBytesRead) = VLQ.decode(input[bytesRead:]);
        bytesRead += actionLenBytesRead;
        operations[0].actions = new IWallet.ActionData[](actionLen);

        for (uint256 i = 0; i < actionLen; i++) {
            (uint256 ethValue, uint256 ethValueBytesRead) = VLQ.decode(input[bytesRead:]);
            bytesRead += ethValueBytesRead;

            address contractAddress = abi.decode(input[bytesRead:bytesRead+20], (address));
            bytesRead += 20;

            (uint256 fnLen, uint256 fnLenBytesRead) = VLQ.decode(input[bytesRead:]);
            bytesRead += fnLenBytesRead;

            bytes memory encodedFunction = input[bytesRead:bytesRead+fnLen];
            bytesRead += fnLen;

            operations[0].actions[i] = IWallet.ActionData({
                ethValue: ethValue,
                contractAddress: contractAddress,
                encodedFunction: encodedFunction
            });
        }
    }
}
