import {
  BigNumber,
  Contract,
  delay,
  ethers,
  hubbleBls,
  Wallet,
} from "../../deps/index.ts";

import * as env from "../env.ts";
import ovmContractABIs from "../../ovmContractABIs/index.ts";
import type { TransactionData } from "./TxTable.ts";
import AddTransactionFailure from "./AddTransactionFailure.ts";
import assert from "../helpers/assert.ts";
import AppEvent from "./AppEvent.ts";

function getKeyHash(pubkey: string) {
  return ethers.utils.keccak256(ethers.utils.solidityPack(
    ["uint256[4]"],
    [hubbleBls.mcl.loadG2(pubkey)],
  ));
}

export type TxCheckResult = {
  failures: AddTransactionFailure[];
  nextNonce: ethers.BigNumber;
};

const addressStringLength = 42;
const pubKeyStringLength = 258;

export default class WalletService {
  rewardErc20: Contract;
  verificationGateway: Contract;

  constructor(
    public emit: (evt: AppEvent) => void,
    public aggregatorSigner: Wallet,
    public nextNonce: number,
  ) {
    this.rewardErc20 = new Contract(
      env.REWARD_TOKEN_ADDRESS,
      ovmContractABIs["MockERC20.json"].abi,
      this.aggregatorSigner,
    );

    this.verificationGateway = new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs["VerificationGateway.json"].abi,
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

    return new WalletService(emit, aggregatorSigner, nextNonce);
  }

  async checkTx(tx: TransactionData): Promise<TxCheckResult> {
    const [signedCorrectly, nextNonce]: [boolean, ethers.BigNumber] = await this
      .verificationGateway
      .checkSig(
        tx.nonce,
        ethers.BigNumber.from(tx.tokenRewardAmount),
        getKeyHash(tx.pubKey),
        hubbleBls.mcl.loadG1(tx.signature),
        tx.contractAddress,
        tx.methodId,
        tx.encodedParams,
      );

    const failures: AddTransactionFailure[] = [];

    if (signedCorrectly === false) {
      failures.push({
        type: "invalid-signature",
        description: "invalid signature",
      });
    }

    if (ethers.BigNumber.from(tx.nonce).lt(nextNonce)) {
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
    txs: TransactionData[],
    maxAttempts = 1,
    retryDelay = 300,
  ): Promise<ethers.providers.TransactionReceipt> {
    assert(txs.length > 0, "Cannot process empty batch");
    assert(maxAttempts > 0, "Must have at least one attempt");

    const txSignatures = txs.map((tx) => hubbleBls.mcl.loadG1(tx.signature));
    const aggSignature = hubbleBls.signer.aggregate(txSignatures);

    const blsCallManyArgs = [
      this.aggregatorSigner.address,
      aggSignature,
      txs.map((tx) => ({
        publicKeyHash: getKeyHash(tx.pubKey),
        tokenRewardAmount: tx.tokenRewardAmount,
        contractAddress: tx.contractAddress,
        methodID: tx.methodId,
        encodedParams: tx.encodedParams,
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

  async sendTx(tx: TransactionData) {
    const txSignature = hubbleBls.mcl.loadG1(tx.signature);

    const txResponse = await this
      .verificationGateway.blsCall(
        getKeyHash(tx.pubKey),
        txSignature,
        ethers.BigNumber.from(tx.tokenRewardAmount),
        tx.contractAddress,
        tx.methodId,
        tx.encodedParams,
        { nonce: this.NextNonce() },
      );

    return await txResponse.wait();
  }

  async getRewardBalanceOf(addressOrPubKey: string): Promise<BigNumber> {
    const address = await this.WalletAddress(addressOrPubKey);
    return await this.rewardErc20.balanceOf(address);
  }

  async WalletAddress(addressOrPubKey: string): Promise<string> {
    if (addressOrPubKey.length === addressStringLength) {
      return addressOrPubKey;
    }

    assert(
      addressOrPubKey.length === pubKeyStringLength,
      "addressOrPubKey length matches neither address nor public key",
    );

    const pubKey = addressOrPubKey;

    const address: string = await this.verificationGateway.walletFromHash(
      ethers.utils.keccak256(pubKey),
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
