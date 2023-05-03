import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  Signer,
  Contract,
  BigNumber,
  BigNumberish,
  providers,
  Overrides,
  ContractReceipt,
} from "ethers";

import {
  BlsWalletWrapper,
  BlsWalletSigner,
  initBlsWalletSigner,
  Bundle,
  getOperationResults,
  FallbackCompressor,
  BlsRegistrationCompressor,
  BundleCompressor,
  Erc20Compressor,
} from "../../clients/src";

import Range from "./Range";
import {
  VerificationGateway,
  BLSOpen,
  BLSExpander,
  BLSExpanderDelegator,
  AggregatorUtilities,
  BLSRegistration,
  ExpanderEntryPoint,
} from "../../typechain-types";
import deploy from "../deploy";
import { fail } from "assert";
import receiptOf from "./receiptOf";

export default class Fixture {
  static readonly ECDSA_ACCOUNTS_LENGTH = 5;
  static readonly DEFAULT_BLS_ACCOUNTS_LENGTH = 5;

  // eslint-disable-next-line no-use-before-define
  static singleton?: Fixture;

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
    public bundleCompressor: BundleCompressor,
    public fallbackCompressor: FallbackCompressor,
    public utilities: AggregatorUtilities,
    public blsRegistration: BLSRegistration,
    public expanderEntryPoint: ExpanderEntryPoint,

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

    const {
      verificationGateway,
      blsLibrary: bls,
      blsExpander,
      blsExpanderDelegator,
      aggregatorUtilities: utilities,
      blsRegistration,
      expanderEntryPoint,
    } = await deploy(signers[0]);

    const fallbackCompressor = await FallbackCompressor.connectIfDeployed(
      signers[0],
    );

    if (fallbackCompressor === undefined) {
      throw new Error("Fallback compressor not set up correctly");
    }

    const erc20Compressor = await Erc20Compressor.connectIfDeployed(signers[0]);

    if (erc20Compressor === undefined) {
      throw new Error("ERC20 compressor not set up correctly");
    }

    const blsRegistrationCompressor =
      await BlsRegistrationCompressor.connectIfDeployed(signers[0]);

    if (blsRegistrationCompressor === undefined) {
      throw new Error("BLS registration compressor not set up correctly");
    }

    const bundleCompressor = new BundleCompressor(blsExpanderDelegator);
    await bundleCompressor.addCompressor(erc20Compressor);
    await bundleCompressor.addCompressor(blsRegistrationCompressor);
    await bundleCompressor.addCompressor(fallbackCompressor);

    const privateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();

    return new Fixture(
      chainId,
      ethers.provider,
      signers,
      addresses,
      verificationGateway,
      bls,
      blsExpander,
      blsExpanderDelegator,
      bundleCompressor,
      fallbackCompressor,
      utilities,
      blsRegistration,
      expanderEntryPoint,
      await initBlsWalletSigner({
        chainId,
        privateKey,
        verificationGatewayAddress: verificationGateway.address,
      }),
    );
  }

  /**
   * The fixture is tied to the chain which is a singleton. It does some things
   * on creation that can only be done once, so it's useful to get this as a
   * singleton.
   */
  static async getSingleton() {
    Fixture.singleton ??= await Fixture.create();
    return Fixture.singleton;
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

  /**
   * Wraps verificationGateway.processBundle, also making sure that all the
   * operations are successful.
   */
  async processBundle(bundle: Bundle, overrides: Overrides = {}) {
    const receipt = await (
      await this.verificationGateway.processBundle(bundle, overrides)
    ).wait();

    this.checkBundleReceipt(receipt);

    return receipt;
  }

  checkBundleReceipt(receipt: ContractReceipt) {
    for (const [i, result] of getOperationResults(receipt).entries()) {
      if (result.error) {
        fail(
          [
            "Operation",
            i,
            "failed at action",
            `${result.error.actionIndex}:`,
            result.error.message,
          ].join(" "),
        );
      }
    }
  }

  /**
   * There seems to be a bug where the automatic gas limit is somtimes not
   * enough in our testing environment. This method works around that by adding
   * 50% to the gas estimate.
   */
  async processBundleWithExtraGas(bundle: Bundle, overrides: Overrides = {}) {
    const gasEstimate =
      await this.verificationGateway.estimateGas.processBundle(
        bundle,
        overrides,
      );

    const gasLimit = gasEstimate.add(gasEstimate.div(2));

    return await this.processBundle(bundle, { ...overrides, gasLimit });
  }

  async processCompressedBundle(
    compressedBundle: string,
    overrides: Overrides = {},
  ) {
    const receipt = await receiptOf(
      this.signers[0].sendTransaction({
        ...overrides,
        to: this.expanderEntryPoint.address,
        data: compressedBundle,
      }),
    );

    this.checkBundleReceipt(receipt);

    return receipt;
  }

  async processCompressedBundleWithExtraGas(
    compressedBundle: string,
    overrides: Overrides = {},
  ) {
    const gasEstimate = await this.signers[0].estimateGas({
      ...overrides,
      to: this.expanderEntryPoint.address,
      data: compressedBundle,
    });

    return await this.processCompressedBundle(compressedBundle, {
      ...overrides,
      gasLimit: gasEstimate.add(gasEstimate.div(2)),
    });
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
