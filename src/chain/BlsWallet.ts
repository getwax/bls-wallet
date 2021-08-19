import {
  BigNumber,
  BlsWalletSigner,
  Contract,
  ethers,
  initBlsWalletSigner,
  TransactionData,
} from "../../deps.ts";

import * as ovmContractABIs from "../../ovmContractABIs/index.ts";
import * as env from "../env.ts";
import assert from "../helpers/assert.ts";
import nil from "../helpers/nil.ts";

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

  static async Exists(privateKey: string, signerOrProvider: SignerOrProvider) {
    return await BlsWallet.Address(privateKey, signerOrProvider) !== nil;
  }

  static async Address(
    privateKey: string,
    signerOrProvider: SignerOrProvider,
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

  static async connectOrCreate(privateKey: string, parent: ethers.Wallet) {
    let wallet = await BlsWallet.connect(privateKey, parent.provider);

    if (wallet !== nil) {
      return wallet;
    }

    const blsWalletSigner = await this.#BlsWalletSigner(parent);
    const verificationGateway = this.#VerificationGateway(parent);

    const tx = blsWalletSigner.sign(
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

    await (await verificationGateway.blsCallCreate(
      tx.publicKey,
      tx.signature,
      tx.tokenRewardAmount,
      tx.contractAddress,
      tx.encodedFunctionData.slice(0, 10),
      `0x${tx.encodedFunctionData.slice(10)}`,
    )).wait();

    wallet = await BlsWallet.connect(privateKey, parent.provider);
    assert(wallet !== nil);

    return wallet;
  }

  static async connect(
    privateKey: string,
    provider: ethers.providers.Provider,
  ) {
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

  async Nonce() {
    return Number(await this.walletContract.nonce());
  }

  buildTx({
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
