import {
  BigNumber,
  BlsWalletSigner,
  Contract,
  ethers,
  TransactionData,
} from "../../deps.ts";

import * as ovmContractABIs from "../../ovmContractABIs/index.ts";
import * as env from "../env.ts";
import assert from "../helpers/assert.ts";
import AsyncReturnType from "../helpers/AsyncReturnType.ts";
import nil from "../helpers/nil.ts";
import blsKeyHash from "./blsKeyHash.ts";
import createBLSWallet from "./createBLSWallet.ts";
import dataPayload from "./dataPayload.ts";
import domain from "./domain.ts";

type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

export default class BlsWallet {
  private constructor(
    public provider: ethers.providers.Provider,
    public network: ethers.providers.Network,
    public verificationGateway: Contract,
    public blsWalletSigner: AsyncReturnType<typeof BlsWalletSigner>,
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
  ): Promise<string | nil> {
    const blsSigner = BlsWallet.#Signer(privateKey);

    const blsPubKeyHash = blsKeyHash(blsSigner);

    const verificationGateway = new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs.VerificationGateway.abi,
      signerOrProvider,
    );

    const address: string = await verificationGateway.walletFromHash(
      blsPubKeyHash,
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

    const network = await provider.getNetwork();

    return new BlsWallet(
      provider,
      network,
      verificationGateway,
      await BlsWalletSigner({ chainId: network.chainId }),
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
