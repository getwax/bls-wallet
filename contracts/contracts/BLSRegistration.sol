//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./interfaces/IExpander.sol";
import "./BLSPublicKeyRegistry.sol";
import "./AddressRegistry.sol";
import "./AggregatorUtilities.sol";
import "./lib/PseudoFloat.sol";

contract BLSRegistration is IExpander {
  BLSPublicKeyRegistry public blsPublicKeyRegistry;
  AddressRegistry public addressRegistry;
  AggregatorUtilities public aggregatorUtilities;

  constructor(
    BLSPublicKeyRegistry blsPublicKeyRegistryParam,
    AddressRegistry addressRegistryParam,
    AggregatorUtilities aggregatorUtilitiesParam
  ) {
    blsPublicKeyRegistry = blsPublicKeyRegistryParam;
    addressRegistry = addressRegistryParam;
    aggregatorUtilities = aggregatorUtilitiesParam;
  }

  function expand(bytes calldata stream) external view returns (
      uint256[4] memory senderPublicKey,
      IWallet.Operation memory operation,
      uint256 bytesRead
  ) {
    uint256 originalStreamLen = stream.length;

    senderPublicKey = abi.decode(stream[:128], (uint256[4]));
    stream = stream[128:];

    uint256 nonce;
    (nonce, stream) = VLQ.decode(stream);

    uint256 gas;
    (gas, stream) = PseudoFloat.decode(stream);

    uint256 txOriginPayment;
    (txOriginPayment, stream) = PseudoFloat.decode(stream);

    uint256 actionLen = 1;

    if (txOriginPayment > 0) {
      actionLen += 1;
    }

    operation = IWallet.Operation({
      nonce: nonce,
      gas: gas,
      actions: new IWallet.ActionData[](actionLen)
    });

    operation.actions[0] = IWallet.ActionData({
      ethValue: 0,
      contractAddress: address(this),
      encodedFunction: abi.encodeWithSignature(
        "register(uint256[4])",
        senderPublicKey
      )
    });

    if (txOriginPayment > 0) {
      operation.actions[1] = IWallet.ActionData({
        ethValue: txOriginPayment,
        contractAddress: address(aggregatorUtilities),
        encodedFunction: abi.encodeWithSignature("sendEthToTxOrigin()")
      });
    }

    bytesRead = originalStreamLen - stream.length;
  }

  function register(uint256[4] memory blsPublicKey) external {
    blsPublicKeyRegistry.register(blsPublicKey);
    addressRegistry.register(msg.sender);
  }
}
