import {
  BigNumber,
  BlsWalletSigner,
  Contract,
  ethers,
  initBlsWalletSigner,
  keccak256,
  TransactionData,
} from "../../deps.ts";

import * as ovmContractABIs from "../../ovmContractABIs/index.ts";
import * as env from "../env.ts";
import assert from "../helpers/assert.ts";
import nil from "../helpers/nil.ts";
import splitHex256 from "../helpers/splitHex256.ts";

type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

export default class BlsWallet {
  private constructor(
    public provider: ethers.providers.Provider,
    public network: ethers.providers.Network,
    public verificationGateway: Contract,
    public blsWalletSigner: BlsWalletSigner,
    public privateKey: string,
    public address: string,
    public walletContract: Contract,
  ) {}

  /** Checks whether the wallet contract has been created for this key. */
  static async Exists(privateKey: string, signerOrProvider: SignerOrProvider) {
    return await BlsWallet.Address(privateKey, signerOrProvider) !== nil;
  }

  /** Get the wallet contract address for the given key, if it exists. */
  static async Address(
    privateKey: string,
    signerOrProvider: SignerOrProvider,
    /**
     * Internal value associated with the bls-wallet-signer library that can be
     * provided as an optimization, otherwise it will be created
     * automatically.
     */
    blsWalletSigner?: BlsWalletSigner,
  ): Promise<string | nil> {
    blsWalletSigner ??= await this.#BlsWalletSigner(signerOrProvider);
    const verificationGateway = this.#VerificationGateway(signerOrProvider);

    const address: string = await verificationGateway.walletFromHash(
      blsWalletSigner.getPublicKeyHash(privateKey),
    );

    if (address === ethers.constants.AddressZero) {
      return nil;
    }

    return address;
  }

  /** Creates a special transaction used for the creation of a wallet. */
  static async signCreation(
    privateKey: string,
    signerOrProvider: SignerOrProvider,
  ): Promise<TransactionData> {
    const blsWalletSigner = await this.#BlsWalletSigner(signerOrProvider);
    const verificationGateway = this.#VerificationGateway(signerOrProvider);

    return blsWalletSigner.sign(
      {
        contractAddress: verificationGateway.address,
        encodedFunctionData: verificationGateway.interface.encodeFunctionData(
          "walletCrossCheck",
          [blsWalletSigner.getPublicKeyHash(privateKey)],
        ),
        nonce: BigNumber.from(0),
        tokenRewardAmount: BigNumber.from(0),
      },
      privateKey,
    );
  }

  static validateCreationTx(
    tx: TransactionData,
    signerOrProvider: SignerOrProvider,
  ): { failures: string[] } {
    const verificationGateway = this.#VerificationGateway(signerOrProvider);

    const expectedEncodedFunctionData = verificationGateway.interface
      .encodeFunctionData(
        "walletCrossCheck",
        [keccak256(tx.publicKey)],
      );

    const failures: string[] = [];

    if (tx.encodedFunctionData !== expectedEncodedFunctionData) {
      failures.push("encoded function data mismatch");
    }

    if (tx.contractAddress !== verificationGateway.address) {
      failures.push("contract address mismatch");
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
    /** Wallet used to create the new wallet, if needed. */
    parent: ethers.Wallet,
  ) {
    let wallet = await BlsWallet.connect(privateKey, parent.provider);

    if (wallet !== nil) {
      return wallet;
    }

    const tx = await BlsWallet.signCreation(privateKey, parent);

    await (await this.#VerificationGateway(parent).blsCallCreate(
      splitHex256(tx.publicKey),
      splitHex256(tx.signature),
      tx.tokenRewardAmount,
      tx.contractAddress,
      tx.encodedFunctionData.slice(0, 10),
      `0x${tx.encodedFunctionData.slice(10)}`,
    )).wait();

    wallet = await BlsWallet.connect(privateKey, parent.provider);
    assert(wallet !== nil);

    return wallet;
  }

  /**
   * Instantiate a `BLSWallet` associated with the provided key if the
   * associated wallet contract already exists.
   */
  static async connect(
    privateKey: string,
    provider: ethers.providers.Provider,
  ): Promise<BlsWallet | nil> {
    const network = await provider.getNetwork();

    const blsWalletSigner = await initBlsWalletSigner({
      chainId: network.chainId,
    });

    const verificationGateway = this.#VerificationGateway(provider);

    const contractAddress = await BlsWallet.Address(privateKey, provider);

    if (contractAddress === nil) {
      return nil;
    }

    const walletContract = new ethers.Contract(
      contractAddress,
      ovmContractABIs.BLSWallet.abi,
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

  /**
   * Sign a transaction, producing a `TransactionData` object suitable for use
   * with an aggregator.
   */
  sign({
    contract,
    method,
    args,
    tokenRewardAmount = BigNumber.from(0),
    nonce,
  }: {
    contract: ethers.Contract;
    method: string;
    args: string[];
    tokenRewardAmount?: BigNumber;
    nonce: BigNumber;
  }): TransactionData {
    return this.blsWalletSigner.sign(
      {
        contractAddress: contract.address,
        encodedFunctionData: contract.interface.encodeFunctionData(
          method,
          args,
        ),
        nonce,
        tokenRewardAmount,
      },
      this.privateKey,
    );
  }

  static #VerificationGateway(signerOrProvider: SignerOrProvider) {
    return new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs.VerificationGateway.abi,
      signerOrProvider,
    );
  }

  static async #BlsWalletSigner(signerOrProvider: SignerOrProvider) {
    const chainId = "getChainId" in signerOrProvider
      ? await signerOrProvider.getChainId()
      : (await signerOrProvider.getNetwork()).chainId;

    return await initBlsWalletSigner({ chainId });
  }
}
