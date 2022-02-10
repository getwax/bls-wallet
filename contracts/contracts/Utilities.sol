//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;

contract Utilities {
  struct FunctionCall {
    address contractAddress;
    bytes encodedFunction;
  }

  struct FunctionResult {
    bool success;
    bytes returnValue;
  }

  function performSequence(
    FunctionCall[] calldata calls
  ) external returns (FunctionResult[] memory) {
    FunctionResult[] memory results = new FunctionResult[](calls.length);

    for (uint256 i = 0; i < calls.length; i++) {
      (
        bool success,
        bytes memory returnValue
      ) = calls[i].contractAddress.call(calls[i].encodedFunction);

      results[i].success = success;
      results[i].returnValue = returnValue;
    }

    return results;
  }

  function ethBalanceOf(address account) external view returns (uint256) {
    return account.balance;
  }
}
