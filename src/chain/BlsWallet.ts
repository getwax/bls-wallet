import {
  blsSignerFactory,
  Contract,
  ethers,
  hubbleBls,
} from "../../deps/index.ts";

import * as ovmContractABIs from "../../ovmContractABIs/index.ts";
import type { TransactionData } from "../app/TxTable.ts";
import * as env from "../env.ts";
import assert from "../helpers/assert.ts";
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
    public secret: string,
    public blsSigner: hubbleBls.signer.BlsSigner,
    public address: string,
    public walletContract: Contract,
  ) {}

  static async Exists(secret: string, signerOrProvider: SignerOrProvider) {
    return await BlsWallet.Address(secret, signerOrProvider) !== nil;
  }

  static async Address(
    secret: string,
    signerOrProvider: SignerOrProvider,
  ): Promise<string | nil> {
    const blsSigner = BlsWallet.#Signer(secret);

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

  static async create(secret: string, parent: ethers.Wallet) {
    await createBLSWallet(
      await parent.getChainId(),
      this.#VerificationGateway(parent),
      this.#Signer(secret),
    );

    const wallet = await BlsWallet.connect(secret, parent.provider);
    assert(wallet !== nil);

    return wallet;
  }

  static async connect(secret: string, provider: ethers.providers.Provider) {
    const blsSigner = BlsWallet.#Signer(secret);
    const verificationGateway = this.#VerificationGateway(provider);

    const contractAddress = await BlsWallet.Address(secret, provider);

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
      await provider.getNetwork(),
      verificationGateway,
      secret,
      blsSigner,
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
    tokenRewardAmount = ethers.BigNumber.from(0),
    nonce,
  }: {
    contract: ethers.Contract;
    method: string;
    args: string[];
    tokenRewardAmount?: ethers.BigNumber;
    nonce: number;
  }): TransactionData {
    const encodedFunction = contract.interface.encodeFunctionData(method, args);

    const message = dataPayload(
      this.network.chainId,
      nonce,
      tokenRewardAmount.toNumber(),
      contract.address,
      encodedFunction,
    );

    const signature = this.blsSigner.sign(message);

    let tokenRewardAmountStr = tokenRewardAmount.toHexString();

    tokenRewardAmountStr = `0x${
      tokenRewardAmountStr.slice(2).padStart(64, "0")
    }`;

    return {
      pubKey: hubbleBls.mcl.dumpG2(this.blsSigner.pubkey),
      nonce,
      signature: hubbleBls.mcl.dumpG1(signature),
      tokenRewardAmount: tokenRewardAmountStr,
      contractAddress: contract.address,
      methodId: encodedFunction.slice(0, 10),
      encodedParams: `0x${encodedFunction.slice(10)}`,
    };
  }

  static #Signer(secret: string) {
    return blsSignerFactory.getSigner(domain, secret);
  }

  static #VerificationGateway(signerOrProvider: SignerOrProvider) {
    return new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs.VerificationGateway.abi,
      signerOrProvider,
    );
  }
}
