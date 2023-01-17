import assert from "assert";
import { ethers } from "ethers";

export default class SafeSingletonFactory {
  static deployment = {
    gasPrice: 100000000000,
    gasLimit: 100000,
    signerAddress: "0xE1CB04A0fA36DdD16a06ea828007E35e1a3cBC37",
    transaction: [
      "0x",
      "f8a78085174876e800830186a08080b853604580600e600039806000f350fe7ffffffff",
      "fffffffffffffffffffffffffffffffffffffffffffffffffffffffe036016000816020",
      "82378035828234f58015156039578182fd5b8082525050506014600cf382f4f5a00dc4d",
      "1d21b308094a30f5f93da35e4d72e99115378f135f2295bea47301a3165a0636b822daa",
      "d40aa8c52dd5132f378c0c0e6d83b4898228c7e21c84e631a0b891",
    ].join(""),
    address: "0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7",
  };

  constructor(public signer: ethers.Signer) {}

  static async init(signer: ethers.Signer): Promise<SafeSingletonFactory> {
    assert(signer.provider !== undefined, "Expected signer with provider");

    const deployment = SafeSingletonFactory.deployment;

    const existingCode = await signer.provider.getCode(deployment.address);

    if (existingCode !== "0x") {
      return new SafeSingletonFactory(signer);
    }

    // Fund the eoa account for the presigned transaction
    await (
      await signer.sendTransaction({
        to: deployment.signerAddress,
        value: ethers.BigNumber.from(deployment.gasPrice).mul(
          deployment.gasLimit,
        ),
      })
    ).wait();

    const deployedCode = await signer.provider.getCode(deployment.address);
    assert(deployedCode !== "0x", "Failed to deploy safe singleton factory");

    return new SafeSingletonFactory(signer);
  }
}
