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
import AsyncReturnType from "../helpers/AsyncReturnType.ts";
import nil from "../helpers/nil.ts";
import blsKeyHash from "./blsKeyHash.ts";
import createBLSWallet from "./createBLSWallet.ts";

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
    const chainId = "getChainId" in signerOrProvider
      ? await signerOrProvider.getChainId()
      : (await signerOrProvider.getNetwork()).chainId;

    blsWalletSigner ??= await initBlsWalletSigner({ chainId });

    const verificationGateway = new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs.VerificationGateway.abi,
      signerOrProvider,
    );

    const address: string = await verificationGateway.walletFromHash(
      blsWalletSigner.getPublicKeyHash(privateKey),
    );

    if (address === ethers.constants.AddressZero) {
      return nil;
    }

    return address;
  }

  static async create(privateKey: string, parent: ethers.Wallet) {
    await createBLSWallet(
      await parent.getChainId(),
      this.#VerificationGateway(parent),
      this.#Signer(privateKey),
    );

    const wallet = await BlsWallet.connect(privateKey, parent.provider);
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
}
