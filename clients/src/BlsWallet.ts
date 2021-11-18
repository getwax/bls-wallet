import * as ethers from 'ethers';
import {
  ActionData,
  BlsWalletSigner,
  initBlsWalletSigner,
  Transaction,
} from 'bls-wallet-signer';

import VerificationGateway from './VerificationGateway';
import BlsWalletAbi from './contractAbis/BlsWalletAbi';

const BigNumber = ethers.BigNumber;
type BigNumber = ethers.BigNumber;

type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

type Action = (
  | {
    ethValue?: BigNumber;
    contract: ethers.Contract,
  }
  | {
    ethValue?: BigNumber;
    contract: ethers.Contract,
    method: string;
    args: string[];
  }
);

export default class BlsWallet {
  private constructor(
    public provider: ethers.providers.Provider,
    public network: ethers.providers.Network,
    public verificationGateway: VerificationGateway,
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

    return await verificationGateway.walletFromHash(
      blsWalletSigner.getPublicKeyHash(privateKey),
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
  ): Promise<BlsWallet> {
    const network = await provider.getNetwork();

    const blsWalletSigner = await initBlsWalletSigner({
      chainId: network.chainId,
    });

    const verificationGateway = new VerificationGateway(
      verificationGatewayAddress,
      provider,
    );

    const contractAddress = await BlsWallet.Address(
      privateKey,
      verificationGatewayAddress,
      provider,
    );

    const walletContract = new ethers.Contract(
      contractAddress,
      BlsWalletAbi,
      provider,
    );

    return new BlsWallet(
      provider,
      network,
      verificationGateway,
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
  sign({ nonce, atomic = true, actions }: {
    nonce: BigNumber;
    atomic?: boolean;
    actions: Action[];
  }): Transaction {
    const fullActions: ActionData[] = actions.map(a => {
      const encodedFunction = ('method' in a
        ? a.contract.interface.encodeFunctionData(a.method, a.args)
        : '0x'
      );

      return {
        ethValue: a.ethValue ?? BigNumber.from(0),
        contractAddress: a.contract.address,
        encodedFunction,
      };
    });

    return this.blsWalletSigner.sign(
      {
        nonce,
        atomic,
        actions: fullActions,
      },
      this.privateKey,
    );
  }

  signTransferToOrigin({ amount, token, nonce }: {
    amount: BigNumber,
    token: ethers.Contract,
    nonce: BigNumber,
  }): Transaction {
    return this.sign({
      nonce,
      actions: [
        {
          contract: this.verificationGateway.contract,
          method: "transferToOrigin",
          args: [amount.toHexString(), token.address],
        }
      ],
    });
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
