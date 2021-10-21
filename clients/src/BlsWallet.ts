import * as ethers from 'ethers';
import {
  BlsWalletSigner,
  initBlsWalletSigner,
  TransactionData,
} from 'bls-wallet-signer';

import VerificationGateway from './VerificationGateway';
import assert from './helpers/assert';
import BlsWalletAbi from './contractAbis/BlsWalletAbi';

const BigNumber = ethers.BigNumber;
type BigNumber = ethers.BigNumber;

type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

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

  /** Checks whether the wallet contract has been created for this key. */
  static async Exists(
    privateKey: string,
    verificationGatewayAddress: string,
    signerOrProvider: SignerOrProvider,
  ): Promise<boolean> {
    const address = await BlsWallet.Address(
      privateKey,
      verificationGatewayAddress,
      signerOrProvider,
    );

    return address !== undefined;
  }

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
  ): Promise<string | undefined> {
    blsWalletSigner ??= await this.#BlsWalletSigner(signerOrProvider);

    const verificationGateway = new VerificationGateway(
      verificationGatewayAddress,
      signerOrProvider,
    );

    return await verificationGateway.walletFromHash(
      blsWalletSigner.getPublicKeyHash(privateKey),
    );
  }

  /** Creates a special transaction used for the creation of a wallet. */
  static async signCreation(
    privateKey: string,
    verificationGatewayAddress: string,
    signerOrProvider: SignerOrProvider,
  ): Promise<TransactionData> {
    const blsWalletSigner = await this.#BlsWalletSigner(signerOrProvider);

    const verificationGateway = new VerificationGateway(
      verificationGatewayAddress,
      signerOrProvider,
    );

    return blsWalletSigner.sign(
      {
        contractAddress: verificationGateway.address,
        encodedFunction: '0x',
        nonce: BigNumber.from(0),
        ethValue: BigNumber.from(0),
      },
      privateKey,
    );
  }

  static async validateCreationTx(
    tx: TransactionData,
    signerOrProvider: SignerOrProvider,
  ): Promise<{ failures: string[] }> {
    const blsWalletSigner = await this.#BlsWalletSigner(signerOrProvider);

    const failures: string[] = [];

    if (!blsWalletSigner.verify(tx)) {
      failures.push('invalid signature');
    }

    if (tx.encodedFunction !== '0x') {
      failures.push('encoded function data mismatch');
    }

    return { failures };
  }

  /**
   * Instantiate a `BLSWallet` associated with the provided key.
   *
   * Creates the associated wallet contract if it doesn't exist yet, which is
   * why a parent wallet is required to create it.
   */
  static async connectOrCreate(
    privateKey: string,
    verificationGatewayAddress: string,
    /** Wallet used to create the new wallet, if needed. */
    parent: ethers.Wallet,
  ): Promise<BlsWallet> {
    let wallet = await BlsWallet.connect(
      privateKey,
      verificationGatewayAddress,
      parent.provider,
    );

    if (wallet !== undefined) {
      return wallet;
    }

    const tx = await BlsWallet.signCreation(
      privateKey,
      verificationGatewayAddress,
      parent,
    );

    const verificationGateway = new VerificationGateway(
      verificationGatewayAddress,
      parent,
    );

    const blsWalletSigner = await this.#BlsWalletSigner(parent.provider);

    await (
      await verificationGateway.actionCalls(
        blsWalletSigner.aggregate([tx]),
      )
    ).wait();

    wallet = await BlsWallet.connect(
      privateKey,
      verificationGatewayAddress,
      parent.provider,
    );

    assert(wallet !== undefined);

    return wallet;
  }

  /**
   * Instantiate a `BLSWallet` associated with the provided key if the
   * associated wallet contract already exists.
   */
  static async connect(
    privateKey: string,
    verificationGatewayAddress: string,
    provider: ethers.providers.Provider,
  ): Promise<BlsWallet | undefined> {
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

    if (contractAddress === undefined) {
      return undefined;
    }

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

    if (contractAddress === undefined) {
      return BigNumber.from(0);
    }

    const walletContract = new ethers.Contract(
      contractAddress,
      [],
      signerOrProvider,
    );

    return await walletContract.nonce();
  }

  /**
   * Sign a transaction, producing a `TransactionData` object suitable for use
   * with an aggregator.
   */
  sign({
    contract,
    method,
    args,
    rewardTokenAddress = ethers.constants.AddressZero,
    rewardTokenAmount = BigNumber.from(0),
    ethValue = BigNumber.from(0),
    nonce,
  }: {
    contract: ethers.Contract;
    method: string;
    args: string[];
    rewardTokenAddress?: string;
    rewardTokenAmount?: BigNumber;
    ethValue?: BigNumber;
    nonce: BigNumber;
  }): TransactionData {
    return this.blsWalletSigner.sign(
      {
        contractAddress: contract.address,
        encodedFunction: contract.interface.encodeFunctionData(method, args),
        nonce,
        ethValue,
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
