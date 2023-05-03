import assert from "assert";
import { ethers, Signer } from "ethers";
import SignerOrProvider from "./helpers/SignerOrProvider";

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

export type ContractFactoryConstructor = {
  new (): ethers.ContractFactory;
};

export type DeployParams<CFC extends ContractFactoryConstructor> =
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
      gasPrice: 100000000000,
      gasLimit: 100000,
      signerAddress: "0xE1CB04A0fA36DdD16a06ea828007E35e1a3cBC37",
      transaction: [
        "0x",
        "f8a78085174876e800830186a08080b853604580600e600039806000f350fe7ffffff",
        "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081",
        "602082378035828234f58015156039578182fd5b8082525050506014600cf3820a96a",
        "0460c6ea9b8f791e5d9e67fbf2c70aba92bf88591c39ac3747ea1bedc2ef1750ca04b",
        "08a4b5cea15a56276513da7a0c0b34f16e89811d5dd911efba5f8625a921cc",
      ].join(""),
      address: SafeSingletonFactory.sharedAddress,
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

  provider: ethers.providers.Provider;

  // eslint-disable-next-line no-use-before-define
  viewer: SafeSingletonFactoryViewer;

  private constructor(
    public signer: ethers.Signer,
    public chainId: number,
    public address: string,
  ) {
    if (signer.provider === undefined) {
      throw new Error("Expected signer with provider");
    }

    this.provider = signer.provider;

    this.viewer = new SafeSingletonFactoryViewer(signer, chainId);
  }

  static async init(signer: ethers.Signer): Promise<SafeSingletonFactory> {
    assert(signer.provider !== undefined, "Expected signer with provider");

    const chainId = await signer.getChainId();

    const address =
      SafeSingletonFactory.deployments[chainId]?.address ??
      SafeSingletonFactory.sharedAddress;

    const existingCode = await signer.provider.getCode(address);

    if (existingCode !== "0x") {
      return new SafeSingletonFactory(signer, chainId, address);
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

    return new SafeSingletonFactory(signer, chainId, deployment.address);
  }

  static async from(signerOrFactory: ethers.Signer | SafeSingletonFactory) {
    if (signerOrFactory instanceof SafeSingletonFactory) {
      return signerOrFactory;
    }

    return await SafeSingletonFactory.init(signerOrFactory);
  }

  calculateAddress<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ) {
    return this.viewer.calculateAddress(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );
  }

  async isDeployed<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<boolean> {
    return this.viewer.isDeployed(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );
  }

  async connectIfDeployed<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<ReturnType<InstanceType<CFC>["attach"]> | undefined> {
    let contract = await this.viewer.connectIfDeployed(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    if (contract !== undefined) {
      contract = contract.connect(this.signer) as typeof contract;
    }

    return contract;
  }

  async connectOrDeploy<CFC extends ContractFactoryConstructor>(
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
      if ((error as { code: string }).code !== "INSUFFICIENT_FUNDS") {
        throw error;
      }

      const gasEstimate = await this.provider.estimateGas(deployTx);
      const gasPrice = await this.provider.getGasPrice();

      const balance = await this.provider.getBalance(this.signer.getAddress());

      throw new Error(
        [
          "Account",
          await this.signer.getAddress(),
          "has insufficient funds:",
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

export class SafeSingletonFactoryViewer {
  safeSingletonFactoryAddress: string;
  signer?: Signer;
  provider: ethers.providers.Provider;

  constructor(
    public signerOrProvider: SignerOrProvider,
    public chainId: number,
  ) {
    this.safeSingletonFactoryAddress =
      SafeSingletonFactory.deployments[chainId]?.address ??
      SafeSingletonFactory.sharedAddress;

    let provider: ethers.providers.Provider | undefined;

    if (ethers.providers.Provider.isProvider(signerOrProvider)) {
      provider = signerOrProvider;
    } else {
      provider = signerOrProvider.provider;
      this.signer = signerOrProvider;
    }

    if (!provider) {
      throw new Error("No provider found");
    }

    this.provider = provider;
  }

  static async from(signerOrProvider: SignerOrProvider) {
    const provider = ethers.providers.Provider.isProvider(signerOrProvider)
      ? signerOrProvider
      : signerOrProvider.provider;

    if (!provider) {
      throw new Error("No provider found");
    }

    const network = await provider.getNetwork();

    return new SafeSingletonFactoryViewer(signerOrProvider, network.chainId);
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
      this.safeSingletonFactoryAddress,
      salt,
      ethers.utils.keccak256(initCode),
    );
  }

  async isDeployed<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ) {
    const address = this.calculateAddress(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    const existingCode = await this.provider.getCode(address);

    return existingCode !== "0x";
  }

  async connectIfDeployed<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<ReturnType<InstanceType<CFC>["attach"]> | undefined> {
    const address = this.calculateAddress(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    const existingCode = await this.provider.getCode(address);

    if (existingCode === "0x") {
      return undefined;
    }

    const contractFactory = new ContractFactoryConstructor();

    let contract = contractFactory.attach(address) as ReturnType<
      InstanceType<CFC>["attach"]
    >;

    if (this.signer) {
      contract = contract.connect(this.signer) as typeof contract;
    }

    return contract;
  }

  async connectOrThrow<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<ReturnType<InstanceType<CFC>["attach"]>> {
    const contract = await this.connectIfDeployed(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    if (!contract) {
      throw new Error(
        `Contract ${
          ContractFactoryConstructor.name
        } not deployed at ${this.calculateAddress(
          ContractFactoryConstructor,
          deployParams,
          salt,
        )}`,
      );
    }

    return contract;
  }
}
