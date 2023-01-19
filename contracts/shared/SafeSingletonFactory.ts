import assert from "assert";
import { ethers } from "ethers";

/**
 * Filters out the optional elements of an array type because an optional
 * element isn't considered to match First in [infer First, ...].
 */
type NonOptionalElementsOf<A extends unknown[]> = A extends [
  infer First,
  ...infer Tail,
]
  ? [First, ...NonOptionalElementsOf<Tail>]
  : A extends [opt?: unknown]
  ? []
  : never;

type ContractFactoryConstructor = {
  new (): ethers.ContractFactory;
};

type DeployParams<CFC extends ContractFactoryConstructor> =
  NonOptionalElementsOf<Parameters<InstanceType<CFC>["deploy"]>>;

type Deployment = {
  gasPrice: number;
  gasLimit: number;
  signerAddress: string;
  transaction: string;
  address: string;
};

export default class SafeSingletonFactory {
  static sharedAddress = "0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7";

  static deployments: Record<number, Deployment | undefined> = {
    1337: {
      // This is a DIY version of Safe's Singleton Factory because chainId 1337
      // is not yet supported. It produces the factory at a different address
      // and therefore all contracts it produces will also have a different
      // address.
      // Mnemonic used:
      //   ivory   sheriff choice lake
      //   special awesome gather portion
      //   vote    dose    follow vessel
      // When this issue is resolved we can update this deployment to resolve
      // it: https://github.com/safe-global/safe-singleton-factory/issues/97.
      gasPrice: 100000000000,
      gasLimit: 100000,
      signerAddress: "0xf8D0D5059A7b8841D2Eb9D3E80c3D54ea84BF52A",
      transaction: [
        "0x",
        "f8a78085174876e800830186a08080b853604580600e600039806000f350fe7ffffff",
        "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081",
        "602082378035828234f58015156039578182fd5b8082525050506014600cf3820a96a",
        "0075740c7c4133e652909dc2aea959997818621ce668d023a088d4675a9148d55a056",
        "37abb8e3431f791ee3eb37277c84c797d98571d0207648e8cc3e18a9c10b79",
      ].join(""),
      address: "0x13914f599b1dDED5215BcCC0BF4e36bb61e5CeAC",
    },
    31337: {
      gasPrice: 100000000000,
      gasLimit: 100000,
      signerAddress: "0xE1CB04A0fA36DdD16a06ea828007E35e1a3cBC37",
      transaction: [
        "0x",
        "f8a78085174876e800830186a08080b853604580600e600039806000f350fe7ffffff",
        "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081",
        "602082378035828234f58015156039578182fd5b8082525050506014600cf382f4f5a",
        "00dc4d1d21b308094a30f5f93da35e4d72e99115378f135f2295bea47301a3165a063",
        "6b822daad40aa8c52dd5132f378c0c0e6d83b4898228c7e21c84e631a0b891",
      ].join(""),
      address: SafeSingletonFactory.sharedAddress,
    },
  };

  constructor(
    public signer: ethers.Signer,
    public provider: ethers.providers.Provider,
    public address: string,
  ) {}

  static async init(signer: ethers.Signer): Promise<SafeSingletonFactory> {
    assert(signer.provider !== undefined, "Expected signer with provider");

    const chainId = await signer.getChainId();

    const address =
      SafeSingletonFactory.deployments[chainId]?.address ??
      SafeSingletonFactory.sharedAddress;

    const existingCode = await signer.provider.getCode(address);

    if (existingCode !== "0x") {
      return new SafeSingletonFactory(signer, signer.provider, address);
    }

    const deployment = SafeSingletonFactory.deployments[chainId];

    if (!deployment) {
      throw new Error(
        [
          "Cannot get deployment for SafeSingletonFactory (check",
          "https://github.com/safe-global/safe-singleton-factory/tree/main/artifacts",
          `for chain id ${chainId})`,
        ].join(" "),
      );
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

    await (
      await signer.provider.sendTransaction(deployment.transaction)
    ).wait();

    const deployedCode = await signer.provider.getCode(deployment.address);
    assert(deployedCode !== "0x", "Failed to deploy safe singleton factory");

    return new SafeSingletonFactory(
      signer,
      signer.provider,
      deployment.address,
    );
  }

  calculateAddress<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ) {
    const contractFactory = new ContractFactoryConstructor();

    const initCode =
      contractFactory.bytecode +
      contractFactory.interface.encodeDeploy(deployParams).slice(2);

    return ethers.utils.getCreate2Address(
      this.address,
      salt,
      ethers.utils.keccak256(initCode),
    );
  }

  async deploy<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<ReturnType<InstanceType<CFC>["attach"]>> {
    const contractFactory = new ContractFactoryConstructor();

    const initCode =
      contractFactory.bytecode +
      contractFactory.interface.encodeDeploy(deployParams).slice(2);

    const address = this.calculateAddress(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    const existingCode = await this.provider.getCode(address);

    if (existingCode !== "0x") {
      return contractFactory.attach(address).connect(this.signer) as ReturnType<
        InstanceType<CFC>["attach"]
      >;
    }

    const deployTx = {
      to: this.address,
      data: ethers.utils.solidityPack(["uint256", "bytes"], [salt, initCode]),
    };

    try {
      await (await this.signer.sendTransaction(deployTx)).wait();
    } catch (error) {
      if ((error as any).code !== "INSUFFICIENT_FUNDS") {
        throw error;
      }

      const gasEstimate = await this.provider.estimateGas(deployTx);
      const gasPrice = await this.provider.getGasPrice();

      const balance = await this.provider.getBalance(this.signer.getAddress());

      throw new Error(
        [
          "Insufficient funds:",
          ethers.utils.formatEther(balance),
          "ETH, need (approx):",
          ethers.utils.formatEther(gasEstimate.mul(gasPrice)),
          "ETH",
        ].join(" "),
      );
    }

    const deployedCode = await this.provider.getCode(address);

    assert(deployedCode !== "0x", "Failed to deploy to expected address");

    return contractFactory.attach(address).connect(this.signer) as ReturnType<
      InstanceType<CFC>["attach"]
    >;
  }
}
