import { ethers, BigNumber, BigNumberish } from "ethers";
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
  // eslint-disable-next-line camelcase
  BLSWallet__factory,
  // eslint-disable-next-line camelcase
  TransparentUpgradeableProxy__factory,
  VerificationGateway,
  // eslint-disable-next-line camelcase
  VerificationGateway__factory,
} from "../typechain";

type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

export default class BlsWalletWrapper {
  public address: string;
  private constructor(
    public blsWalletSigner: BlsWalletSigner,
    public privateKey: string,
    public walletContract: BLSWallet,
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

    return BLSWallet__factory.connect(
      contractAddress,
      verificationGateway.provider,
    );
  }

  /** Get the wallet contract address for the given private key */
  static async Address(
    privateKey: string,
    verificationGatewayAddress: string,
    signerOrProvider: SignerOrProvider,
    /**
     * Internal value associated with the bls-wallet-signer library that can be
     * provided as an optimization, otherwise it will be created
     * automatically.
     */
    blsWalletSigner?: BlsWalletSigner,
  ): Promise<string> {
    blsWalletSigner ??= await this.#BlsWalletSigner(signerOrProvider);

    const verificationGateway = VerificationGateway__factory.connect(
      verificationGatewayAddress,
      signerOrProvider,
    );
    const pubKeyHash = blsWalletSigner.getPublicKeyHash(privateKey);

    const existingAddress = await verificationGateway.walletFromHash(
      pubKeyHash,
    );
    if (!BigNumber.from(existingAddress).isZero()) {
      return existingAddress;
    }

    return this.ExpectedAddress(verificationGateway, pubKeyHash);
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

  /**
   * Instantiate a `BLSWallet` associated with the provided key if the
   * associated wallet contract already exists.
   */
  static async connect(
    privateKey: string,
    verificationGatewayAddress: string,
    provider: ethers.providers.Provider,
  ): Promise<BlsWalletWrapper> {
    const verificationGateway = VerificationGateway__factory.connect(
      verificationGatewayAddress,
      provider,
    );
    const blsWalletSigner = await initBlsWalletSigner({
      chainId: (await verificationGateway.provider.getNetwork()).chainId,
    });

    const blsWalletWrapper = new BlsWalletWrapper(
      blsWalletSigner,
      privateKey,
      await BlsWalletWrapper.BLSWallet(privateKey, verificationGateway),
    );

    return blsWalletWrapper;
  }

  async syncWallet(verificationGateway: VerificationGateway) {
    this.address = await BlsWalletWrapper.Address(
      this.privateKey,
      verificationGateway.address,
      verificationGateway.provider,
    );

    this.walletContract = BLSWallet__factory.connect(
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
    const verificationGateway = VerificationGateway__factory.connect(
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

    const walletContract = BLSWallet__factory.connect(
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

  /** Sign an operation, producing a `Bundle` object suitable for use with an aggregator. */
  sign(operation: Operation): Bundle {
    return this.blsWalletSigner.sign(
      operation,
      this.privateKey,
      this.walletContract.address,
    );
  }

  /** Sign a message */
  signMessage(message: string): Signature {
    return this.blsWalletSigner.signMessage(message, this.privateKey);
  }

  /**
   * Gets the BLS public key associated with this wallet.
   *
   * @returns Wallet's BLS public key.
   */
  PublicKey(): PublicKey {
    return this.blsWalletSigner.getPublicKey(this.privateKey);
  }

  /**
   * Gets the BLS public key associated with this wallet as a concatenated string.
   *
   * @returns Wallet's BLS public key as a string.
   */
  PublicKeyStr(): string {
    return this.blsWalletSigner.getPublicKeyStr(this.privateKey);
  }

  static async #BlsWalletSigner(
    signerOrProvider: SignerOrProvider,
  ): Promise<BlsWalletSigner> {
    const chainId =
      "getChainId" in signerOrProvider
        ? await signerOrProvider.getChainId()
        : (await signerOrProvider.getNetwork()).chainId;

    return await initBlsWalletSigner({ chainId });
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
      BLSWallet__factory.createInterface().encodeFunctionData("initialize", [
        verificationGateway.address,
      ]);

    return ethers.utils.getCreate2Address(
      verificationGateway.address,
      pubKeyHash,
      ethers.utils.solidityKeccak256(
        ["bytes", "bytes"],
        [
          TransparentUpgradeableProxy__factory.bytecode,
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "bytes"],
            [blsWalletLogicAddress, proxyAdminAddress, initFunctionParams],
          ),
        ],
      ),
    );
  }
}
