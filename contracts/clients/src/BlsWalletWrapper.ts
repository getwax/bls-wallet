import { ethers, BigNumber } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";

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
  // eslint-disable-next-line camelcase
  VerificationGateway__factory,
} from "../typechain";

type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

export default class BlsWalletWrapper {
  private constructor(
    public blsWalletSigner: BlsWalletSigner,
    public privateKey: string,
    public address: string,
    public walletContract: BLSWallet,
  ) {}

  /** Get the wallet contract address for the given key, if it exists. */
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

    const [proxyAdminAddress, blsWalletLogicAddress] = await Promise.all([
      verificationGateway.walletProxyAdmin(),
      verificationGateway.blsWalletLogic(),
    ]);

    const initFunctionParams =
      BLSWallet__factory.createInterface().encodeFunctionData("initialize", [
        verificationGatewayAddress,
      ]);

    return ethers.utils.getCreate2Address(
      verificationGatewayAddress,
      blsWalletSigner.getPublicKeyHash(privateKey),
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

  /**
   * Instantiate a `BLSWallet` associated with the provided key if the
   * associated wallet contract already exists.
   */
  static async connect(
    privateKey: string,
    verificationGatewayAddress: string,
    provider: ethers.providers.Provider,
  ): Promise<BlsWalletWrapper> {
    const network = await provider.getNetwork();

    const blsWalletSigner = await initBlsWalletSigner({
      chainId: network.chainId,
    });

    const contractAddress = await BlsWalletWrapper.Address(
      privateKey,
      verificationGatewayAddress,
      provider,
    );

    const walletContract = BLSWallet__factory.connect(
      contractAddress,
      provider,
    );

    return new BlsWalletWrapper(
      blsWalletSigner,
      privateKey,
      contractAddress,
      walletContract,
    );
  }

  /**
   * Get the next expected nonce for the wallet contract based on the latest
   * block.
   */
  async Nonce(): Promise<BigNumber> {
    const code = await this.walletContract.provider.getCode(this.address);

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
    return this.blsWalletSigner.sign(operation, this.privateKey);
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
}
