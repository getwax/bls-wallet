import * as ethers from 'ethers';
import {
  ActionData,
  BlsWalletSigner,
  initBlsWalletSigner,
  Transaction,
} from './signer';

import VerificationGateway from './VerificationGateway';
import BlsWalletAbi from './contractAbis/BlsWalletAbi';
import TransparentUpgradeableProxyBytecode from './contractAbis/TransparentUpgradeableProxyBytecode';

const BigNumber = ethers.BigNumber;
type BigNumber = ethers.BigNumber;

type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

export default class BlsWalletWrapper {
  private constructor(
    public blsWalletSigner: BlsWalletSigner,
    public privateKey: string,
    public address: string,
    public walletContract: ethers.Contract,
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

    const verificationGateway = new VerificationGateway(
      verificationGatewayAddress,
      signerOrProvider,
    );

    const proxyAdminAddress = await verificationGateway.contract.proxyAdmin();
    const blsWalletLogicAddress = await verificationGateway.contract.blsWalletLogic();

    const initFunctionParams = new ethers.utils.Interface(BlsWalletAbi).encodeFunctionData(
      "initialize",
      [verificationGatewayAddress],
    );

    return ethers.utils.getCreate2Address(
      verificationGatewayAddress,
      blsWalletSigner.getPublicKeyHash(privateKey),
      ethers.utils.solidityKeccak256(
        ["bytes", "bytes"],
        [
          TransparentUpgradeableProxyBytecode,
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "bytes"],
            [
              blsWalletLogicAddress,
              proxyAdminAddress,
              initFunctionParams,
            ],
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

    const walletContract = new ethers.Contract(
      contractAddress,
      BlsWalletAbi,
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
    const verificationGateway = new VerificationGateway(
      verificationGatewayAddress,
      signerOrProvider,
    );

    const publicKeyHash = ethers.utils.keccak256(publicKey);
    const contractAddress = await verificationGateway.walletFromHash(publicKeyHash);

    const walletContract = new ethers.Contract(
      contractAddress,
      BlsWalletAbi,
      signerOrProvider,
    );

    // TODO: What happens when VG hasn't created the wallet yet? This probably
    // throws, and we need to return zero in this case.
    return await walletContract.nonce();
  }

  /**
   * Sign a transaction, producing a `TransactionData` object suitable for use
   * with an aggregator.
   */
  sign({ nonce, atomic, actions }: {
    nonce: BigNumber;
    atomic: boolean;
    actions: ActionData[];
  }): Transaction {
    return this.blsWalletSigner.sign(
      {
        nonce,
        atomic,
        actions,
      },
      this.privateKey,
    );
  }

  static async #BlsWalletSigner(
    signerOrProvider: SignerOrProvider,
  ): Promise<BlsWalletSigner> {
    const chainId =
      'getChainId' in signerOrProvider
        ? await signerOrProvider.getChainId()
        : (await signerOrProvider.getNetwork()).chainId;

    return await initBlsWalletSigner({ chainId });
  }
}
