/* eslint-disable camelcase */

import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import { Signer, Contract, BigNumber, BigNumberish, providers } from "ethers";

import {
  BlsWalletWrapper,
  BlsWalletSigner,
  initBlsWalletSigner,
  Bundle,
} from "../../clients/src";

import Range from "./Range";
import Create2Fixture from "./Create2Fixture";
import {
  AggregatorUtilities,
  BLSExpander,
  BLSOpen,
  BLSWallet__factory,
  ProxyAdmin,
  BLSExpanderDelegator__factory,
  BLSExpanderDelegator,
  VerificationGateway,
} from "../../typechain-types";

export default class Fixture {
  static readonly ECDSA_ACCOUNTS_LENGTH = 5;
  static readonly DEFAULT_BLS_ACCOUNTS_LENGTH = 5;

  static readonly expanderIndexes = {
    fallback: 0,
  };

  private constructor(
    public chainId: number,
    public provider: providers.Provider,

    public signers: Signer[],
    public addresses: string[],

    public verificationGateway: VerificationGateway,

    public blsLibrary: BLSOpen,
    public blsExpander: BLSExpander,
    public blsExpanderDelegator: BLSExpanderDelegator,
    public utilities: AggregatorUtilities,

    // eslint-disable-next-line camelcase
    public BLSWallet: BLSWallet__factory,
    public blsWalletSigner: BlsWalletSigner,
  ) {}

  /// @dev Contracts deployed by first ethers signer
  static async create() {
    const chainId = (await ethers.provider.getNetwork()).chainId;

    const allSigners = await ethers.getSigners();
    const signers = allSigners.slice(0, Fixture.ECDSA_ACCOUNTS_LENGTH);
    const addresses = (await Promise.all(
      signers.map((acc) => acc.getAddress()),
    )) as string[];

    const create2Fixture = Create2Fixture.create();

    // deploy wallet implementation contract
    const blsWalletImpl = await create2Fixture.create2Contract("BLSWallet");
    const initializedEvents = await blsWalletImpl.queryFilter(
      blsWalletImpl.filters.Initialized(),
    );
    if (!initializedEvents.length) {
      await blsWalletImpl.initialize(ethers.constants.AddressZero);
    }

    const bls = (await create2Fixture.create2Contract("BLSOpen")) as BLSOpen;
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = (await ProxyAdmin.deploy()) as ProxyAdmin;
    await proxyAdmin.deployed();
    // deploy Verification Gateway
    const verificationGateway = (await create2Fixture.create2Contract(
      "VerificationGateway",
      ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "address"],
        [bls.address, blsWalletImpl.address, proxyAdmin.address],
      ),
    )) as VerificationGateway;
    await (
      await proxyAdmin.transferOwnership(verificationGateway.address)
    ).wait();

    // deploy BLSExpander Gateway
    const blsExpander = (await create2Fixture.create2Contract(
      "BLSExpander",
      ethers.utils.defaultAbiCoder.encode(
        ["address"],
        [verificationGateway.address],
      ),
    )) as BLSExpander;

    const blsExpanderDelegatorUntyped = await create2Fixture.create2Contract(
      "BLSExpanderDelegator",
      ethers.utils.defaultAbiCoder.encode(
        ["address"],
        [verificationGateway.address],
      ),
    );

    const blsExpanderDelegator = BLSExpanderDelegator__factory.connect(
      blsExpanderDelegatorUntyped.address,
      blsExpanderDelegatorUntyped.signer,
    );

    const fallbackExpander = await create2Fixture.create2Contract(
      "FallbackExpander",
    );

    await (
      await blsExpanderDelegator.registerExpander(0, fallbackExpander.address)
    ).wait();

    // deploy utilities
    const utilities = (await create2Fixture.create2Contract(
      "AggregatorUtilities",
    )) as AggregatorUtilities;

    const BLSWallet = await ethers.getContractFactory("BLSWallet");

    return new Fixture(
      chainId,
      ethers.provider,
      signers,
      addresses,
      verificationGateway,
      bls,
      blsExpander,
      blsExpanderDelegator,
      utilities,
      BLSWallet,
      await initBlsWalletSigner({ chainId }),
    );
  }

  /**
   * Creates new BLS contract wallets from private keys
   * @returns array of wallets
   */
  async createBLSWallets(count: number): Promise<BlsWalletWrapper[]> {
    return Range(count).reduce(async (prev) => {
      const wallets = await prev;
      return [...wallets, await this.createBLSWallet()];
    }, Promise.resolve([]));
  }

  async createBLSWallet(): Promise<BlsWalletWrapper> {
    return BlsWalletWrapper.connect(
      `0x${Math.floor(Math.random() * 0xffffffff).toString(16)}`,
      this.verificationGateway.address,
      this.provider,
    );
  }

  bundleFrom(
    wallet: BlsWalletWrapper,
    contract: Contract,
    method: string,
    params: any[],
    nonce: BigNumberish,
    gas: BigNumberish,
    ethValue: BigNumberish = 0,
  ): Bundle {
    return this.blsWalletSigner.aggregate([
      wallet.sign({
        nonce,
        gas,
        actions: [
          {
            ethValue,
            contractAddress: contract.address,
            encodedFunction: contract.interface.encodeFunctionData(
              method,
              params,
            ),
          },
        ],
      }),
    ]);
  }

  async call(
    wallet: BlsWalletWrapper,
    contract: Contract,
    method: string,
    params: any[],
    nonce: BigNumberish,
    gas: BigNumberish,
    ethValue: BigNumberish = 0,
  ) {
    await (
      await this.verificationGateway.processBundle(
        this.bundleFrom(wallet, contract, method, params, nonce, gas, ethValue),
      )
    ).wait();
  }

  async callStatic(
    wallet: BlsWalletWrapper,
    contract: Contract,
    method: string,
    params: any[],
    nonce: BigNumberish,
    gas: BigNumberish,
    ethValue: BigNumberish = 0,
  ) {
    return await this.verificationGateway.callStatic.processBundle(
      this.bundleFrom(wallet, contract, method, params, nonce, gas, ethValue),
    );
  }

  async advanceTimeBy(seconds: number) {
    // Advance time one week
    const latestTimestamp = (await ethers.provider.getBlock("latest"))
      .timestamp;

    await network.provider.send("evm_setNextBlockTimestamp", [
      BigNumber.from(latestTimestamp).add(seconds).toHexString(),
    ]);

    // Send an empty transaction so that the next timestamp above actually gets
    // into a block. This enables static calls to see the updated time.
    await this.signers[0].sendTransaction({
      value: 0,
      to: this.signers[0].getAddress(),
    });
  }
}
