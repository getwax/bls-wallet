import { ethers, BigNumber } from "ethers";
import { keccak256, solidityKeccak256, solidityPack } from "ethers/lib/utils";
import {
  BlsWalletSigner,
  initBlsWalletSigner,
  Bundle,
  Operation,
  PublicKey,
  Signature,
} from "./signer";

import {
  BLSWallet,
  BLSWallet__factory as BLSWalletFactory,
  TransparentUpgradeableProxy__factory as TransparentUpgradeableProxyFactory,
  VerificationGateway,
  VerificationGateway__factory as VerificationGatewayFactory,
} from "../typechain-types";

import getRandomBlsPrivateKey from "./signer/getRandomBlsPrivateKey";

type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

/**
 * Class representing a BLS Wallet
 */
export default class BlsWalletWrapper {
  public address: string;
  public blockGasLimit: BigNumber = BigNumber.from(0);
  private constructor(
    public blsWalletSigner: BlsWalletSigner,
    public walletContract: BLSWallet,
    public defaultGatewayAddress: string,
  ) {
    this.address = walletContract.address;
  }

  static async BLSWallet(
    privateKey: string,
    verificationGateway: VerificationGateway,
  ): Promise<BLSWallet> {
    const contractAddress = await BlsWalletWrapper.Address(
      privateKey,
      verificationGateway.address,
      verificationGateway.provider,
    );

    return BLSWalletFactory.connect(
      contractAddress,
      verificationGateway.provider,
    );
  }

  /**
   * Gets the address for this wallet.
   *
   * This could be:
   *  - The address the wallet is registered to on the VerificationGateway.
   *  - The expected address if it has not already be created/registered.
   *  - The original wallet address before it was recovered to another key pair.
   *
   * Throws an exception if wallet was recovered to a different private key.
   *
   * @param privateKey private key associated with the wallet
   * @param verificationGatewayAddress address of the VerficationGateway contract
   * @param signerOrProvider ethers.js Signer or Provider
   * @returns The wallet's address
   */
  static async Address(
    privateKey: string,
    verificationGatewayAddress: string,
    signerOrProvider: SignerOrProvider,
  ): Promise<string> {
    const blsWalletSigner = await this.#BlsWalletSigner(
      signerOrProvider,
      privateKey,
      verificationGatewayAddress,
    );

    const verificationGateway = VerificationGatewayFactory.connect(
      verificationGatewayAddress,
      signerOrProvider,
    );
    const pubKeyHash = blsWalletSigner.getPublicKeyHash();

    const existingAddress = await verificationGateway.walletFromHash(
      pubKeyHash,
    );
    const hasExistingAddress = !BigNumber.from(existingAddress).isZero();
    if (hasExistingAddress) {
      return existingAddress;
    }

    const expectedAddress = await this.ExpectedAddress(
      verificationGateway,
      pubKeyHash,
    );
    this.validateWalletNotRecovered(
      blsWalletSigner,
      verificationGateway,
      expectedAddress,
    );

    return expectedAddress;
  }

  /** Get the wallet contract address for the given public key */
  static async AddressFromPublicKey(
    publicKey: PublicKey,
    verificationGateway: VerificationGateway,
  ): Promise<string> {
    const pubKeyHash = keccak256(solidityPack(["uint256[4]"], [publicKey]));

    const existingAddress = await verificationGateway.walletFromHash(
      pubKeyHash,
    );
    if (!BigNumber.from(existingAddress).isZero()) {
      return existingAddress;
    }

    return this.ExpectedAddress(verificationGateway, pubKeyHash);
  }

  static async getRandomBlsPrivateKey(): Promise<string> {
    return getRandomBlsPrivateKey();
  }

  /**
   * Instantiate a `BLSWallet` associated with the provided private key.
   * associated wallet contract already exists.
   *
   * Throws an exception if wallet was recovered to a different private key.
   *
   * @param privateKey private key associated with the wallet
   * @param verificationGatewayAddress address of the VerficationGateway contract
   * @param provider ethers.js Provider
   * @returns a BLS Wallet
   */
  static async connect(
    privateKey: string,
    verificationGatewayAddress: string,
    provider: ethers.providers.Provider,
  ): Promise<BlsWalletWrapper> {
    const verificationGateway = VerificationGatewayFactory.connect(
      verificationGatewayAddress,
      provider,
    );
    const blsWalletSigner = await initBlsWalletSigner({
      chainId: (await verificationGateway.provider.getNetwork()).chainId,
      verificationGatewayAddress,
      privateKey,
    });

    const blsWalletWrapper = new BlsWalletWrapper(
      blsWalletSigner,
      await BlsWalletWrapper.BLSWallet(privateKey, verificationGateway),
      verificationGateway.address,
    );
    blsWalletWrapper.blockGasLimit = (
      await provider.getBlock("latest")
    ).gasLimit;

    return blsWalletWrapper;
  }

  async syncWallet(verificationGateway: VerificationGateway) {
    this.address = await BlsWalletWrapper.Address(
      this.blsWalletSigner.privateKey,
      verificationGateway.address,
      verificationGateway.provider,
    );

    this.walletContract = BLSWalletFactory.connect(
      this.address,
      verificationGateway.provider,
    );
  }

  /**
   * Get the next expected nonce for the wallet contract based on the latest
   * block.
   */
  async Nonce(): Promise<BigNumber> {
    const code = await this.walletContract.provider.getCode(
      this.walletContract.address,
    );

    if (code === "0x") {
      // The wallet doesn't exist yet. Wallets are lazily created, so the nonce
      // is effectively zero, since that will be accepted as valid for a first
      // operation that also creates the wallet.
      return BigNumber.from(0);
    }

    return this.walletContract.nonce();
  }

  static async Nonce(
    publicKey: PublicKey,
    verificationGatewayAddress: string,
    signerOrProvider: SignerOrProvider,
  ): Promise<BigNumber> {
    const verificationGateway = VerificationGatewayFactory.connect(
      verificationGatewayAddress,
      signerOrProvider,
    );

    const publicKeyHash = solidityKeccak256(
      ["uint256", "uint256", "uint256", "uint256"],
      publicKey,
    );

    const contractAddress = await verificationGateway.walletFromHash(
      publicKeyHash,
    );

    const walletContract = BLSWalletFactory.connect(
      contractAddress,
      signerOrProvider,
    );

    const code = await walletContract.provider.getCode(contractAddress);

    if (code === "0x") {
      // The wallet doesn't exist yet. Wallets are lazily created, so the nonce
      // is effectively zero, since that will be accepted as valid for a first
      // operation that also creates the wallet.
      return BigNumber.from(0);
    }

    return await walletContract.nonce();
  }

  /** Sign an operation with an estimate of the gas required. */
  async signWithGasEstimate(
    operation: Omit<Operation, "gas">,

    /**
     * Optional: Multiply estimate by `(1+overhead)` to account for uncertainty.
     * Reduces the chance of running out of gas.
     */
    overhead = 0,
  ): Promise<Bundle> {
    let gas = await this.estimateGas(operation);
    gas = gas.add(gas.div(10000).mul(Math.ceil(overhead * 10000)));

    return this.sign({ ...operation, gas });
  }

  /** Estimate the gas needed for an operation. */
  async estimateGas(operation: Omit<Operation, "gas">): Promise<BigNumber> {
    const exists =
      (await this.walletContract.provider.getCode(this.address)) !== "0x";

    const gatewayAddress = exists
      ? await this.walletContract.trustedBLSGateway()
      : this.defaultGatewayAddress;

    const gateway = VerificationGatewayFactory.connect(
      gatewayAddress,
      this.walletContract.provider,
    );

    const gas = await gateway
      .connect(ethers.constants.AddressZero)
      .callStatic.measureOperationGas(this.PublicKey(), {
        ...operation,
        gas: this.blockGasLimit,
      });

    return gas;
  }

  /** Sign an operation, producing a `Bundle` object suitable for use with an aggregator. */
  sign(operation: Operation): Bundle {
    return this.blsWalletSigner.sign(operation, this.walletContract.address);
  }

  /** Sign a message */
  signMessage(message: string): Signature {
    return this.blsWalletSigner.signMessage(message);
  }

  /**
   * Gets the BLS public key associated with this wallet.
   *
   * @returns Wallet's BLS public key.
   */
  PublicKey(): PublicKey {
    return this.blsWalletSigner.getPublicKey();
  }

  /**
   * Gets the BLS public key associated with this wallet as a concatenated string.
   *
   * @returns Wallet's BLS public key as a string.
   */
  PublicKeyStr(): string {
    return this.blsWalletSigner.getPublicKeyStr();
  }

  async getSetRecoveryHashBundle(
    salt: string,
    recoverWalletAddress: string,
  ): Promise<Bundle> {
    const saltHash = ethers.utils.formatBytes32String(salt);
    const walletHash = this.blsWalletSigner.getPublicKeyHash();
    const recoveryHash = ethers.utils.solidityKeccak256(
      ["address", "bytes32", "bytes32"],
      [recoverWalletAddress, walletHash, saltHash],
    );

    return await this.signWithGasEstimate({
      nonce: await this.Nonce(),
      actions: [
        {
          ethValue: 0,
          contractAddress: this.walletContract.address,
          encodedFunction: this.walletContract.interface.encodeFunctionData(
            "setRecoveryHash",
            [recoveryHash],
          ),
        },
      ],
    });
  }

  async getRecoverWalletBundle(
    recoveryAddress: string,
    newPrivateKey: string,
    recoverySalt: string,
    verificationGateway: VerificationGateway,
    signatureExpiryTimestamp: number,
  ): Promise<Bundle> {
    const updatedWallet = await BlsWalletWrapper.connect(
      newPrivateKey,
      verificationGateway.address,
      verificationGateway.provider,
    );
    const addressMessage = solidityPack(
      ["address", "uint256"],
      [recoveryAddress, signatureExpiryTimestamp],
    );
    const addressSignature = updatedWallet.signMessage(addressMessage);

    const recoveryWalletHash = await verificationGateway.hashFromWallet(
      recoveryAddress,
    );
    const saltHash = ethers.utils.formatBytes32String(recoverySalt);

    return await this.signWithGasEstimate({
      nonce: await this.Nonce(),
      actions: [
        {
          ethValue: 0,
          contractAddress: verificationGateway.address,
          encodedFunction: verificationGateway.interface.encodeFunctionData(
            "recoverWallet",
            [
              addressSignature,
              recoveryWalletHash,
              saltHash,
              updatedWallet.PublicKey(),
              signatureExpiryTimestamp,
            ],
          ),
        },
      ],
    });
  }

  static async #BlsWalletSigner(
    signerOrProvider: SignerOrProvider,
    privateKey: string,
    verificationGatewayAddress: string,
  ): Promise<BlsWalletSigner> {
    const chainId =
      "getChainId" in signerOrProvider
        ? await signerOrProvider.getChainId()
        : (await signerOrProvider.getNetwork()).chainId;

    return await initBlsWalletSigner({
      chainId,
      privateKey,
      verificationGatewayAddress,
    });
  }

  // Calculates the expected address the wallet will be created at
  private static async ExpectedAddress(
    verificationGateway: VerificationGateway,
    pubKeyHash: string,
  ): Promise<string> {
    const [proxyAdminAddress, blsWalletLogicAddress] = await Promise.all([
      verificationGateway.walletProxyAdmin(),
      verificationGateway.blsWalletLogic(),
    ]);

    const initFunctionParams =
      BLSWalletFactory.createInterface().encodeFunctionData("initialize", [
        verificationGateway.address,
      ]);

    return ethers.utils.getCreate2Address(
      verificationGateway.address,
      pubKeyHash,
      ethers.utils.solidityKeccak256(
        ["bytes", "bytes"],
        [
          TransparentUpgradeableProxyFactory.bytecode,
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "bytes"],
            [blsWalletLogicAddress, proxyAdminAddress, initFunctionParams],
          ),
        ],
      ),
    );
  }

  private static async validateWalletNotRecovered(
    blsWalletSigner: BlsWalletSigner,
    verificationGateway: VerificationGateway,
    walletAddress: string,
  ): Promise<void> {
    const pubKeyHash = blsWalletSigner.getPublicKeyHash();
    const existingPubKeyHash = await verificationGateway.hashFromWallet(
      walletAddress,
    );

    const walletIsAlreadyRegistered =
      !BigNumber.from(existingPubKeyHash).isZero();
    const pubKeyHashesDoNotMatch = pubKeyHash !== existingPubKeyHash;

    if (walletIsAlreadyRegistered && pubKeyHashesDoNotMatch) {
      throw new Error(
        `wallet at ${walletAddress} has been recovered from public key hash ${pubKeyHash} to ${existingPubKeyHash}`,
      );
    }
  }
}
