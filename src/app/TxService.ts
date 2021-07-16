import { ethers } from "../../deps/index.ts";

import AddTransactionFailure from "./AddTransactionFailure.ts";
import * as env from "./env.ts";
import TxTable, { TransactionData } from "./TxTable.ts";
import WalletService from "./WalletService.ts";

export default class TxService {
  static defaultConfig = {
    txQueryLimit: env.TX_QUERY_LIMIT,
    maxFutureTxs: env.MAX_FUTURE_TXS,
  };

  constructor(
    public readyTxTable: TxTable,
    public futureTxTable: TxTable,
    public walletService: WalletService,
    public config = TxService.defaultConfig,
  ) {}

  async add(txData: TransactionData): Promise<AddTransactionFailure[]> {
    const { failures, nextNonce } = await this.walletService.checkTx(txData);

    if (failures.length > 0) {
      return failures;
    }

    const highestReadyNonce = await this.HighestReadyNonce(
      nextNonce,
      txData.pubKey,
    );

    if (txData.nonce < highestReadyNonce) {
      return this.replaceReadyTx(highestReadyNonce, txData);
    }

    if (highestReadyNonce === txData.nonce) {
      await this.readyTxTable.add(txData);
      await this.tryMoveFutureTxs(txData.pubKey, highestReadyNonce + 1);
    } else {
      await this.ensureFutureTxSpace();
      await this.futureTxTable.add(txData);
    }

    return [];
  }

  /**
   * Find the highest nonce that can be added to ready txs. This needs to be
   * higher than both the latest nonce on chain and any tx nonces (for this key)
   * that are locally ready.
   */
  async HighestReadyNonce(
    nextChainNonce: ethers.BigNumber,
    pubKey: string,
  ): Promise<number> {
    const nextLocalNonce = await this.readyTxTable.nextNonceOf(pubKey);

    const highestReadyNonce = nextChainNonce.gt(nextLocalNonce ?? 0)
      ? nextChainNonce
      : ethers.BigNumber.from(nextLocalNonce);

    // This will cause problems above 2^53. Currently we already store nonces as
    // 32 bit integers in the database anyway though. For now, numbers are more
    // convenient.
    //
    // More information: https://github.com/jzaki/aggregator/issues/36.
    return highestReadyNonce.toNumber();
  }

  /**
   * Move any future txs for the given public key that have become ready into
   * ready txs.
   */
  async tryMoveFutureTxs(
    pubKey: string,
    highestReadyNonce: number,
  ) {
    let futureTxsToRemove: TransactionData[];

    do {
      futureTxsToRemove = [];
      const txsToAdd: TransactionData[] = [];

      const futureTxs = await this.futureTxTable.pubKeyTxsInNonceOrder(
        pubKey,
        this.config.txQueryLimit,
      );

      let i = 0;

      for (; futureTxs[i]?.nonce < highestReadyNonce; i++) {
        futureTxsToRemove.push(futureTxs[i]);
        await this.replaceReadyTx(highestReadyNonce, futureTxs[i]);
      }

      for (; futureTxs[i]?.nonce === highestReadyNonce; i++) {
        futureTxsToRemove.push(futureTxs[i]);
        let futureTx = futureTxs[i];
        const nonce = futureTx.nonce;

        for (; futureTxs[i + 1]?.nonce === nonce; i++) {
          futureTxsToRemove.push(futureTxs[i + 1]);

          if (this.isRewardBetter(futureTxs[i + 1], futureTx)) {
            futureTx = futureTxs[i + 1];
          }
        }

        const futureTxWithoutId = { ...futureTx };
        delete futureTxWithoutId.txId;
        txsToAdd.push(futureTxWithoutId);
        highestReadyNonce++;
      }

      await this.readyTxTable.add(...txsToAdd);
      await this.futureTxTable.remove(...futureTxsToRemove);
    } while (futureTxsToRemove.length === this.config.txQueryLimit);
  }

  /**
   * Ensures that at least one new transaction can be inserted into the future
   * tx table without exceeding maxFutureTxs. This is achieved by dropping txs
   * that have been stored the longest.
   */
  async ensureFutureTxSpace() {
    const size = await this.futureTxTable.count();

    if (size >= this.config.maxFutureTxs) {
      const first = await this.futureTxTable.First();

      if (first === null) {
        console.warn(
          "Future txs unexpectedly empty when it seemed to need pruning",
        );

        return;
      }

      const newFirstId = (
        first.txId! + (Number(size) - this.config.maxFutureTxs + 1)
      );

      this.futureTxTable.clearBeforeId(newFirstId);
    }
  }

  /**
   * Replace a ready transaction with one of the same nonce.
   *
   * Note: This also means re-inserting any followup ready transactions of the
   * same key so that they will be processed in the correct sequence.
   */
  async replaceReadyTx(
    highestReadyNonce: number,
    txData: TransactionData,
  ): Promise<AddTransactionFailure[]> {
    const existingTx = await this.readyTxTable.find(
      txData.pubKey,
      txData.nonce,
    );

    if (existingTx === null) {
      return [{
        type: "duplicate-nonce",
        description: [
          `nonce ${txData.nonce} was a replacement candidate but it appears to`,
          "have been submitted during processing",
        ].join(" "),
      }];

      // Possible enhancement: Track submitted txs and consider also submitting
      // replacements. This would interfere with aggregate txs already in the
      // mempool. Complicated.
    }

    if (!this.isRewardBetter(txData, existingTx)) {
      return [{
        type: "insufficient-reward",
        description: [
          `${ethers.BigNumber.from(txData.tokenRewardAmount)} is an`,
          "insufficient reward because there is already a tx with this nonce",
          "with a reward of",
          ethers.BigNumber.from(existingTx.tokenRewardAmount),
        ].join(" "),
      }];
    }

    const promises: Promise<unknown>[] = [];

    promises.push(
      this.readyTxTable.remove(existingTx),
      this.readyTxTable.add(txData),
    );

    if (highestReadyNonce - 1 === txData.nonce) {
      await Promise.all(promises);
      return [];
    }

    let followupTxs;
    let lastNonceReplaced = txData.nonce;

    while (true) {
      followupTxs = await this.readyTxTable.findAfter(
        txData.pubKey,
        lastNonceReplaced,
        this.config.txQueryLimit,
      );

      if (followupTxs.length === 0) {
        break;
      }

      for (const tx of followupTxs) {
        const newTx = { ...tx };
        delete newTx.txId;

        promises.push(
          this.readyTxTable.remove(tx),
          this.readyTxTable.add(newTx),
        );
      }

      lastNonceReplaced = followupTxs[followupTxs.length - 1].nonce;

      if (followupTxs.length < this.config.txQueryLimit) {
        break;
      }
    }

    await Promise.all(promises);
    return [];
  }

  isRewardBetter(left: TransactionData, right: TransactionData) {
    const leftReward = ethers.BigNumber.from(left.tokenRewardAmount);
    const rightReward = ethers.BigNumber.from(right.tokenRewardAmount);

    return leftReward.gt(rightReward);
  }
}
