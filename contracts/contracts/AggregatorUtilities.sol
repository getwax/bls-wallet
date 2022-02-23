//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;

contract AggregatorUtilities {
  struct FunctionCall {
    address contractAddress;
    bytes encodedFunction;
  }

  struct FunctionResult {
    bool success;
    bytes returnValue;
  }

  /// @notice Perform a sequence of function calls returning all the results.
  ///         This is useful for inspecting side effects. In particular,
  ///         functions that contain a token or eth transfer can be measured
  ///         by sandwiching the function between balance calls.
  /// @param calls The function calls to perform.
  /// @return The results of each function call.
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

  /// @notice Retrieve the eth balance of the nominated account. This is useful
  ///         in combination with performSequence above because it allows this
  ///         operation to be represented as a function call.
  /// @param account Account address
  /// @return Eth balance of the account
  function ethBalanceOf(address account) external view returns (uint256) {
    return account.balance;
  }

  function getTxOrigin() external view returns (address) {
    return tx.origin;
  }
}
