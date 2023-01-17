//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

/**
 * Generates a ProxyAdmin and transfers its ownership to msg.sender.
 * 
 * This is useful to avoid including ProxyAdmin in your contract bytecode.
 * Instead ProxyAdmin is included in this contract, and this contract's address
 * can be provided to your contract's constructor.
 */
contract ProxyAdminGenerator {
  function generate() external returns (ProxyAdmin) {
    ProxyAdmin pa = new ProxyAdmin();
    pa.transferOwnership(msg.sender);

    return pa;
  }
}
