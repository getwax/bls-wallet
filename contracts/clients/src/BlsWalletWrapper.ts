import { ethers, BigNumber } from "ethers";
import {
  BlsWalletSigner,
  initBlsWalletSigner,
  Bundle,
  Operation,
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

    const proxyAdminAddress = await verificationGateway.proxyAdmin();
    const blsWalletLogicAddress = await verificationGateway.blsWalletLogic();

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
    // TODO: What happens when VG hasn't created the wallet yet? This probably
    // throws, and we need to return zero in this case.
    return await this.walletContract.nonce();
  }

  static async Nonce(
    publicKey: string,
    verificationGatewayAddress: string,
    signerOrProvider: SignerOrProvider,
  ): Promise<BigNumber> {
    const verificationGateway = VerificationGateway__factory.connect(
      verificationGatewayAddress,
      signerOrProvider,
    );

    const publicKeyHash = ethers.utils.keccak256(publicKey);
    const contractAddress = await verificationGateway.walletFromHash(
      publicKeyHash,
    );

    const walletContract = BLSWallet__factory.connect(
      contractAddress,
      signerOrProvider,
    );

    // TODO: What happens when VG hasn't created the wallet yet? This probably
    // throws, and we need to return zero in this case.
    return await walletContract.nonce();
  }

  /** Sign an operation, producing a `Bundle` object suitable for use with an aggregator. */
  sign(operation: Operation): Bundle {
    return this.blsWalletSigner.sign(operation, this.privateKey);
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
