import {
  BigNumber,
  BlsWallet,
  BlsWalletSigner,
  delay,
  ethers,
  initBlsWalletSigner,
  keccak256,
  TransactionData,
  VerificationGateway,
  Wallet,
} from "../../deps.ts";

import * as env from "../env.ts";
import TransactionFailure from "./TransactionFailure.ts";
import assert from "../helpers/assert.ts";
import AppEvent from "./AppEvent.ts";
import { TxTableRow } from "./TxTable.ts";
import nil from "../helpers/nil.ts";
import IERC20Abi from "../../contractAbis/IERC20Abi.ts";

export type TxCheckResult = {
  failures: TransactionFailure[];
  nextNonce: BigNumber;
};

export type CreateWalletResult = {
  address?: string;
  failures: TransactionFailure[];
};

const addressStringLength = 42;
const publicKeyStringLength = 258;

export default class WalletService {
  verificationGateway: VerificationGateway;

  constructor(
    public emit: (evt: AppEvent) => void,
    public aggregatorSigner: Wallet,
    public blsWalletSigner: BlsWalletSigner,
    public nextNonce: number,
  ) {
    this.verificationGateway = new VerificationGateway(
      env.VERIFICATION_GATEWAY_ADDRESS,
      this.aggregatorSigner,
    );
  }

  NextNonce() {
    const result = this.nextNonce++;
    return result;
  }

  static async create(
    emit: (evt: AppEvent) => void,
    aggPrivateKey: string,
  ): Promise<WalletService> {
    const aggregatorSigner = WalletService.getAggregatorSigner(aggPrivateKey);
    const nextNonce = (await aggregatorSigner.getTransactionCount());
    const chainId = await aggregatorSigner.getChainId();
    const blsWalletSigner = await initBlsWalletSigner({ chainId });

    return new WalletService(
      emit,
      aggregatorSigner,
      blsWalletSigner,
      nextNonce,
    );
  }

  async checkTx(tx: TransactionData): Promise<TxCheckResult> {
    const signedCorrectly = this.blsWalletSigner.verify(tx);

    const failures: TransactionFailure[] = [];

    if (signedCorrectly === false) {
      failures.push({
        type: "invalid-signature",
        description: "invalid signature",
      });
    }

    const nextNonce = await BlsWallet.Nonce(
      tx.publicKey,
      env.VERIFICATION_GATEWAY_ADDRESS,
      this.aggregatorSigner,
    );

    if (BigNumber.from(tx.nonce).lt(nextNonce)) {
      failures.push({
        type: "duplicate-nonce",
        description: [
          `nonce ${tx.nonce} has already been processed (the next nonce for`,
          `this wallet will be ${nextNonce.toString()})`,
        ].join(" "),
      });
    }

    return { failures, nextNonce };
  }

  async sendTxs(
    txs: TxTableRow[],
    maxAttempts = 1,
    retryDelay = 300,
  ): Promise<ethers.providers.TransactionReceipt> {
    assert(txs.length > 0, "Cannot process empty batch");
    assert(maxAttempts > 0, "Must have at least one attempt");

    const aggregateTx = this.blsWalletSigner.aggregate(txs);

    const actionCallsArgs: Parameters<VerificationGateway["actionCalls"]> = [
      aggregateTx,
      { nonce: this.NextNonce() },
    ];

    const attempt = async () => {
      let txResponse: ethers.providers.TransactionResponse;

      try {
        txResponse = await this.verificationGateway.actionCalls(
          ...actionCallsArgs,
        );
      } catch (error) {
        // Distinguish this error because it means something bigger is wrong
        // with the transaction and it's not worth retrying.
        return { type: "responseError" as const, value: error };
      }

      try {
        return { type: "receipt" as const, value: await txResponse.wait() };
      } catch (error) {
        return { type: "waitError" as const, value: error };
      }
    };

    const txIds = txs.map((tx) => tx.txId);

    for (let i = 0; i < maxAttempts; i++) {
      this.emit({
        type: "batch-attempt",
        data: { attemptNumber: i + 1, txIds },
      });

      const attemptResult = await attempt();

      if (attemptResult.type === "receipt") {
        return attemptResult.value;
      }

      if (attemptResult.type === "responseError") {
        throw attemptResult.value;
      }

      const waitError = attemptResult.value;

      if (i !== maxAttempts - 1) {
        this.emit({
          type: "batch-attempt-failed",
          data: {
            attemptNumber: i + 1,
            txIds,
            error: waitError,
          },
        });

        await delay(retryDelay);
      } else {
        throw waitError;
      }
    }

    throw new Error("Expected return or throw from attempt loop");
  }

  async createWallet(
    tx: TransactionData,
  ): Promise<CreateWalletResult> {
    const failures: TransactionFailure[] = [];

    const creationValidation = await BlsWallet.validateCreationTx(
      tx,
      this.aggregatorSigner.provider,
    );

    failures.push(...creationValidation.failures.map((description) => ({
      type: "invalid-creation" as const,
      description,
    })));

    if (failures.length > 0) {
      return { address: nil, failures };
    }

    await this.sendTxs([tx], Infinity, 300);

    const address = await this.verificationGateway.walletFromHash(
      keccak256(tx.publicKey),
    );

    return { address, failures };
  }

  async getBalanceOf(
    ownerAddressOrPublicKey: string,
    tokenAddress: string,
  ): Promise<BigNumber> {
    const address = await this.WalletAddress(ownerAddressOrPublicKey);

    const token = new ethers.Contract(
      tokenAddress,
      IERC20Abi,
      this.aggregatorSigner.provider,
    );

    return await token.balanceOf(address);
  }

  async WalletAddress(addressOrPublicKey: string): Promise<string> {
    if (addressOrPublicKey.length === addressStringLength) {
      return addressOrPublicKey;
    }

    assert(
      addressOrPublicKey.length === publicKeyStringLength,
      "addressOrPublicKey length matches neither address nor public key",
    );

    const publicKey = addressOrPublicKey;

    const address = await this.verificationGateway.walletFromHash(
      ethers.utils.keccak256(publicKey),
    );

    assert(
      address !== undefined,
      "Wallet does not exist",
    );

    return address;
  }

  private static getAggregatorSigner(privateKey: string) {
    const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
    const aggregatorSigner = new Wallet(privateKey, provider);

    if (env.USE_TEST_NET) {
      const originalPopulateTransaction = aggregatorSigner.populateTransaction
        .bind(
          aggregatorSigner,
        );

      aggregatorSigner.populateTransaction = (transaction) => {
        transaction.gasPrice = 0;
        return originalPopulateTransaction(transaction);
      };
    }

    return aggregatorSigner;
  }
}
