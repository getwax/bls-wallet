import { ethers, QueryClient } from "../../deps/index.ts";
import { IClock } from "../helpers/Clock.ts";
import groupBy from "../helpers/groupBy.ts";
import Mutex from "../helpers/Mutex.ts";

import AddTransactionFailure from "./AddTransactionFailure.ts";
import BatchTimer from "./BatchTimer.ts";
import * as env from "./env.ts";
import runQueryGroup from "./runQueryGroup.ts";
import TxTable, { TransactionData } from "./TxTable.ts";
import WalletService from "./WalletService.ts";

export default class TxService {
  static defaultConfig = {
    txQueryLimit: env.TX_QUERY_LIMIT,
    maxFutureTxs: env.MAX_FUTURE_TXS,
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    maxAggregationDelayMillis: env.MAX_AGGREGATION_DELAY_MILLIS,
  };

  batchTimer: BatchTimer;

  constructor(
    public clock: IClock,
    public queryClient: QueryClient,
    public txTablesMutex: Mutex,
    public readyTxTable: TxTable,
    public futureTxTable: TxTable,
    public walletService: WalletService,
    public config = TxService.defaultConfig,
  ) {
    this.batchTimer = new BatchTimer(
      clock,
      config.maxAggregationDelayMillis,
      () => this.runBatch(),
    );

    this.checkReadyTxCount();
  }

  async checkReadyTxCount() {
    const readyTxCount = await this.readyTxTable.count();

    if (readyTxCount >= this.config.maxAggregationSize) {
      this.batchTimer.trigger();
    } else if (readyTxCount > 0) {
      this.batchTimer.notifyTxWaiting();
    } else {
      this.batchTimer.clear();
    }
  }

  runQueryGroup<T>(body: () => Promise<T>): Promise<T> {
    return runQueryGroup(this.txTablesMutex, this.queryClient, body);
  }

  async add(txData: TransactionData): Promise<AddTransactionFailure[]> {
    return await this.runQueryGroup(async () => {
      let checkTxResult;

      try {
        checkTxResult = await this.walletService.checkTx(txData);
      } catch (error) {
        if (error.message.includes("code=UNPREDICTABLE_GAS_LIMIT,")) {
          return [{
            type: "unpredictable-gas-limit",
            description: [
              "Checking transaction produced UNPREDICTABLE_GAS_LIMIT, which",
              "may not be super-helpful. We don't know what went wrong.",
            ].join(" "),
          }];
        }

        throw error;
      }

      const {
        failures,
        nextNonce: nextChainNonce,
      } = checkTxResult;

      if (failures.length > 0) {
        return failures;
      }

      const highestReadyNonce = await this.HighestReadyNonce(
        nextChainNonce,
        txData.pubKey,
      );

      if (txData.nonce < highestReadyNonce) {
        return await this.replaceReadyTx(highestReadyNonce, txData);
      }

      if (highestReadyNonce === txData.nonce) {
        this.readyTxTable.add(txData);
        await this.tryMoveFutureTxs(txData.pubKey, highestReadyNonce + 1);
        this.checkReadyTxCount();
      } else {
        await this.ensureFutureTxSpace();
        this.futureTxTable.add(txData);
      }

      return [];
    });
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
   * ready txs. These future txs can share nonces, so we also pick the txs with
   * the best rewards here to ensure duplicate nonces don't reach ready txs.
   */
  async tryMoveFutureTxs(
    pubKey: string,
    highestReadyNonce: number,
  ) {
    let needNextBatch: boolean;

    do {
      const txsToAdd: TransactionData[] = [];

      const futureTxs = await this.futureTxTable.pubKeyTxsInNonceOrder(
        pubKey,
        this.config.txQueryLimit,
      );

      const bestFutureTxs = groupBy(futureTxs, (tx) => tx.nonce)
        .map((txGroup) => this.pickBestReward(txGroup.elements));

      for (const tx of bestFutureTxs) {
        if (tx.nonce < highestReadyNonce) {
          await this.replaceReadyTx(highestReadyNonce, tx);
        } else if (tx.nonce === highestReadyNonce) {
          txsToAdd.push(TxService.removeTxId(tx));
          highestReadyNonce++;
        } else {
          break;
        }
      }

      const futureTxsToRemove = futureTxs.filter(
        (tx) => tx.nonce < highestReadyNonce,
      );

      await this.readyTxTable.add(...txsToAdd);
      await this.futureTxTable.remove(...futureTxsToRemove);

      // If we remove all future txs in this batch, we need to process the next
      // one too.
      //
      // To put it another way, if there is a future tx that doesn't get
      // removed, that signals that we've reached a nonce that can't be moved
      // to ready txs, and any following batches will all be at least that
      // nonce, and so cannot be moved to ready txs.
      needNextBatch = futureTxsToRemove.length === this.config.txQueryLimit;
    } while (needNextBatch);
  }

  /**
   * Ensures that at least one new transaction can be inserted into the future
   * tx table without exceeding maxFutureTxs. This is achieved by dropping txs
   * that have been stored the longest.
   */
  async ensureFutureTxSpace() {
    const size = await this.futureTxTable.count();

    if (size >= this.config.maxFutureTxs) {
      const [first] = await this.futureTxTable.getHighestPriority(1);

      if (first === undefined) {
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
    newTx: TransactionData,
  ): Promise<AddTransactionFailure[]> {
    const existingTx = await this.readyTxTable.find(
      newTx.pubKey,
      newTx.nonce,
    );

    if (existingTx === null) {
      return [{
        type: "duplicate-nonce",
        description: [
          `nonce ${newTx.nonce} was a replacement candidate but it appears to`,
          "have been submitted during processing",
        ].join(" "),
      }];

      // Possible enhancement: Track submitted txs and consider also submitting
      // replacements. This would interfere with aggregate txs already in the
      // mempool. Complicated.
    }

    if (!this.isRewardBetter(newTx, existingTx)) {
      return [{
        type: "insufficient-reward",
        description: [
          `${ethers.BigNumber.from(newTx.tokenRewardAmount)} is an`,
          "insufficient reward because there is already a tx with this nonce",
          "with a reward of",
          ethers.BigNumber.from(existingTx.tokenRewardAmount),
        ].join(" "),
      }];
    }

    await Promise.all([
      this.readyTxTable.remove(existingTx),
      this.readyTxTable.add(newTx),
    ]);

    const latestReadyNonce = highestReadyNonce - 1;
    const causedUnorderedReadyTxs = newTx.nonce < latestReadyNonce;

    if (causedUnorderedReadyTxs) {
      await this.reinsertUnorderedReadyTxs(newTx);
    }

    return [];
  }

  /**
   * When a ready tx is replaced, the new tx causes any following nonces for
   * that address to be incorrectly ordered. Here we reinsert those txs to fix
   * that.
   */
  async reinsertUnorderedReadyTxs(newTx: TransactionData) {
    const promises: Promise<unknown>[] = [];

    let finished: boolean;
    let followupTxs: TransactionData[];
    let lastNonceReplaced = newTx.nonce;

    do {
      followupTxs = await this.readyTxTable.findAfter(
        newTx.pubKey,
        lastNonceReplaced,
        this.config.txQueryLimit,
      );

      if (followupTxs.length === 0) {
        break;
      }

      for (const tx of followupTxs) {
        this.readyTxTable.remove(tx);
        this.readyTxTable.add(TxService.removeTxId(tx));
      }

      lastNonceReplaced = followupTxs[followupTxs.length - 1].nonce;

      // If followupTxs is under the query limit, then we know there aren't any
      // more followups to process. Otherwise, we need to get more txs from the
      // database and keep going.
      finished = followupTxs.length < this.config.txQueryLimit;
    } while (!finished);

    await Promise.all(promises);
  }

  async removeReadyTxs(txs: TransactionData[]) {
    this.readyTxTable.remove(...txs);

    await Promise.all(
      TxService.PublicKeys(txs).map((pk) =>
        this.demoteNoLongerReadyTxs(
          pk,
          txs.find((tx) => tx.pubKey === pk)!,
        )
      ),
    );
  }

  async demoteNoLongerReadyTxs(
    /** Public key this operation applies to */
    pubKey: string,
    /**
     * Example transaction with this public key, facilitating a call to
     * this.walletService.checkTx
     *
     * Enhancement: Remove the need for this by providing a way to check the
     * next chain nonce of a public key without checking a transaction.
     */
    exampleTx: TransactionData,
  ) {
    const promises: Promise<unknown>[] = [];

    let nextNonce = (await this.walletService.checkTx(exampleTx))
      .nextNonce.toNumber();

    let finished: boolean;
    let txs: TransactionData[];

    // Start by finding after one less than the next nonce, so that the first
    // result returned is the next nonce if it is available. This allows us to
    // increment nextNonce and allow readyTxs that are not gapped to stay in
    // ready.
    let findAfterNonce = nextNonce - 1;

    do {
      txs = await this.readyTxTable.findAfter(
        pubKey,
        findAfterNonce,
        this.config.txQueryLimit,
      );

      if (txs.length === 0) {
        break;
      }

      for (const tx of txs) {
        if (tx.nonce === nextNonce) {
          nextNonce++;
        } else {
          promises.push(
            this.readyTxTable.remove(tx),
            this.futureTxTable.add(TxService.removeTxId(tx)),
          );
        }
      }

      findAfterNonce = txs[txs.length - 1].nonce;

      // If txs is under the query limit, then we know there aren't any more txs
      // to process. Otherwise, we need to get more txs from the database and
      // keep going.
      finished = txs.length < this.config.txQueryLimit;
    } while (!finished);

    await Promise.all(promises);
  }

  isRewardBetter(left: TransactionData, right: TransactionData) {
    const leftReward = ethers.BigNumber.from(left.tokenRewardAmount);
    const rightReward = ethers.BigNumber.from(right.tokenRewardAmount);

    return leftReward.gt(rightReward);
  }

  pickBestReward(txs: TransactionData[]) {
    return txs.reduce((left, right) =>
      this.isRewardBetter(left, right) ? left : right
    );
  }

  async runBatch() {
    return await this.runQueryGroup(async () => {
      const priorityTxs = await this.readyTxTable.getHighestPriority(
        this.config.txQueryLimit,
      );

      const pubKeys = TxService.PublicKeys(priorityTxs);

      const rewardBalances = Object.fromEntries(
        pubKeys.map((pk) => [pk, ethers.BigNumber.from(0)]),
      );

      await Promise.all(
        pubKeys.map(async (pk) => {
          const address = await this.walletService.WalletAddress(pk);

          if (address === null) {
            console.warn(`Unable to map public key ${pk} to address`);
            return;
          }

          rewardBalances[pk] = await this.walletService.getRewardBalanceOf(
            address,
          );
        }),
      );

      const batchTxs: TransactionData[] = [];
      const insufficientRewardTxs: TransactionData[] = [];
      const gappedPubKeys: string[] = [];

      for (const tx of priorityTxs) {
        if (gappedPubKeys.includes(tx.pubKey)) {
          continue;
        }

        if (rewardBalances[tx.pubKey].gte(tx.tokenRewardAmount)) {
          batchTxs.push(tx);

          rewardBalances[tx.pubKey] = rewardBalances[tx.pubKey]
            .sub(tx.tokenRewardAmount);
        } else {
          insufficientRewardTxs.push(tx);
          gappedPubKeys.push(tx.pubKey);
        }

        if (batchTxs.length >= this.config.maxAggregationSize) {
          break;
        }
      }

      if (batchTxs.length > 0) {
        await this.walletService.sendTxs(batchTxs);
      }

      await this.removeReadyTxs([...batchTxs, ...insufficientRewardTxs]);

      this.checkReadyTxCount();
    });
  }

  static PublicKeys(txs: TransactionData[]) {
    return Object.keys(Object.fromEntries(txs.map((tx) => [tx.pubKey])));
  }

  static removeTxId(tx: TransactionData) {
    const newTx = { ...tx };
    delete newTx.txId;
    return newTx;
  }
}
