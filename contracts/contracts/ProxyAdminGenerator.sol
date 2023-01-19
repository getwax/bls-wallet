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
  function generate(bytes32 salt) external returns (ProxyAdmin) {
    // This salting technique ensures two things:
    // 1. Your ProxyAdmin has a predetermined address
    // 2. No one else can generate or prevent access to your ProxyAdmin
    bytes32 fullSalt = keccak256(abi.encode(msg.sender, salt));

    ProxyAdmin pa = new ProxyAdmin{salt: fullSalt}();
    pa.transferOwnership(msg.sender);

    return pa;
  }
}
