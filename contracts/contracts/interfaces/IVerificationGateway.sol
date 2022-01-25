//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;

interface IVerificationGateway {
  function isVerificationGateway() external pure returns (bool);
}
