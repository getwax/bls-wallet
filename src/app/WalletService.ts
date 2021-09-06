import {
  BigNumber,
  BlsWalletSigner,
  Contract,
  delay,
  ethers,
  initBlsWalletSigner,
  keccak256,
  TransactionData,
  Wallet,
} from "../../deps.ts";

import * as env from "../env.ts";
import * as ovmContractABIs from "../../ovmContractABIs/index.ts";
import AddTransactionFailure from "./AddTransactionFailure.ts";
import assert from "../helpers/assert.ts";
import AppEvent from "./AppEvent.ts";
import { TxTableRow } from "./TxTable.ts";
import splitHex256 from "../helpers/splitHex256.ts";

export type TxCheckResult = {
  failures: AddTransactionFailure[];
  nextNonce: BigNumber;
};

const addressStringLength = 42;
const publicKeyStringLength = 258;

export default class WalletService {
  rewardErc20: Contract;
  verificationGateway: Contract;

  constructor(
    public emit: (evt: AppEvent) => void,
    public aggregatorSigner: Wallet,
    public blsWalletSigner: BlsWalletSigner,
    public nextNonce: number,
  ) {
    this.rewardErc20 = new Contract(
      env.REWARD_TOKEN_ADDRESS,
      ovmContractABIs.MockERC20.abi,
      this.aggregatorSigner,
    );

    this.verificationGateway = new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs.VerificationGateway.abi,
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
    const [signedCorrectly, nextNonce]: [boolean, BigNumber] = await this
      .verificationGateway
      .checkSig(
        tx.nonce,
        BigNumber.from(tx.tokenRewardAmount),
        keccak256(tx.publicKey),
        splitHex256(tx.signature),
        tx.contractAddress,
        tx.encodedFunctionData.slice(0, 10),
        `0x${tx.encodedFunctionData.slice(10)}`,
      );

    const failures: AddTransactionFailure[] = [];

    if (signedCorrectly === false) {
      failures.push({
        type: "invalid-signature",
        description: "invalid signature",
      });
    }

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

    const blsCallManyArgs = [
      this.aggregatorSigner.address,
      splitHex256(aggregateTx.signature),
      txs.map((tx) => ({
        publicKeyHash: keccak256(tx.publicKey),
        tokenRewardAmount: tx.tokenRewardAmount,
        contractAddress: tx.contractAddress,
        methodID: tx.encodedFunctionData.slice(0, 10),
        encodedParams: `0x${tx.encodedFunctionData.slice(10)}`,
      })),
      { nonce: this.NextNonce() },
    ];

    const attempt = async () => {
      let txResponse: ethers.providers.TransactionResponse;

      try {
        txResponse = await this.verificationGateway.blsCallMany(
          ...blsCallManyArgs,
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

  async sendTx(
    tx: TransactionData,
  ): Promise<ethers.providers.TransactionReceipt> {
    const txResponse = await this
      .verificationGateway.blsCall(
        ethers.utils.keccak256(tx.publicKey),
        splitHex256(tx.signature),
        BigNumber.from(tx.tokenRewardAmount),
        tx.contractAddress,
        tx.encodedFunctionData.slice(0, 10),
        `0x${tx.encodedFunctionData.slice(10)}`,
        { nonce: this.NextNonce() },
      );

    return await txResponse.wait();
  }

  async getRewardBalanceOf(addressOrPublicKey: string): Promise<BigNumber> {
    const address = await this.WalletAddress(addressOrPublicKey);
    return await this.rewardErc20.balanceOf(address);
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

    const address: string = await this.verificationGateway.walletFromHash(
      ethers.utils.keccak256(publicKey),
    );

    assert(
      address !== ethers.constants.AddressZero,
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
