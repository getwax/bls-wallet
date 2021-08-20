import {
  BigNumber,
  delay,
  ethers,
  QueryClient,
  TransactionData,
} from "../../deps.ts";
import { IClock } from "../helpers/Clock.ts";
import groupBy from "../helpers/groupBy.ts";
import Mutex from "../helpers/Mutex.ts";

import AddTransactionFailure from "./AddTransactionFailure.ts";
import BatchTimer from "./BatchTimer.ts";
import * as env from "../env.ts";
import runQueryGroup from "./runQueryGroup.ts";
import TxTable, { TxTableRow } from "./TxTable.ts";
import WalletService, { TxCheckResult } from "./WalletService.ts";
import AppEvent from "./AppEvent.ts";
import nil from "../helpers/nil.ts";

export default class TxService {
  static defaultConfig = {
    txQueryLimit: env.TX_QUERY_LIMIT,
    maxFutureTxs: env.MAX_FUTURE_TXS,
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    maxAggregationDelayMillis: env.MAX_AGGREGATION_DELAY_MILLIS,
    maxUnconfirmedAggregations: env.MAX_UNCONFIRMED_AGGREGATIONS,
  };

  unconfirmedTxs = new Set<TxTableRow>();
  batchTimer: BatchTimer;
  batchesInProgress = 0;

  constructor(
    public emit: (evt: AppEvent) => void,
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
    if (this.batchesInProgress > 0) {
      // No need to check because there is already a batch in progress, and a
      // new check is run after every batch.
      return;
    }

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
    let checkTxResult: TxCheckResult;

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

    return await this.runQueryGroup(async () => {
      const {
        failures,
        nextNonce: nextChainNonce,
      } = checkTxResult;

      if (failures.length > 0) {
        return failures;
      }

      const nextNonce = await this.NextNonce(
        // TODO: Move this to some other .toNumber() conversion
        // This will cause problems above 2^53. Currently we already store
        // nonces as 32 bit integers in the database anyway though. For now,
        // numbers are more convenient.
        //
        // More information: https://github.com/jzaki/aggregator/issues/36.
        nextChainNonce,
        txData.publicKey,
      );

      const emitAdded = (category: "ready" | "future") => {
        this.emit({
          type: "tx-added",
          data: {
            category,
            publicKeyShort: txData.publicKey.slice(2, 9),
            nonce: txData.nonce.toNumber(),
          },
        });
      };

      if (txData.nonce.lt(nextNonce)) {
        const result = await this.replaceReadyTx(nextNonce, txData);
        emitAdded("ready");
        return result;
      }

      if (nextNonce.eq(txData.nonce)) {
        this.readyTxTable.add(txData);
        await this.tryMoveFutureTxs(txData.publicKey, nextNonce.add(1));
        emitAdded("ready");
        this.checkReadyTxCount();
      } else {
        await this.ensureFutureTxSpace();
        this.futureTxTable.add(txData);
        emitAdded("future");
      }

      return [];
    });
  }

  /**
   * Find the nonce that would come after the unconfirmed transactions for this
   * public key, or zero.
   */
  NextUnconfirmedNonce(publicKey: string): BigNumber {
    const unconfirmedTxs = [...this.unconfirmedTxs.values()]
      .filter((tx) => tx.publicKey === publicKey);

    if (unconfirmedTxs.length === 0) {
      return BigNumber.from(0);
    }

    const highestUnconfirmedNonce = unconfirmedTxs
      .map((tx) => tx.nonce)
      .reduce(bigMax);

    return highestUnconfirmedNonce.add(1);
  }

  /**
   * Find the highest nonce that can be added to ready txs. This needs to be
   * higher than:
   * - the latest nonce on chain
   * - the latest nonce in the ready table
   * - the latest nonce in unconfirmed txs
   */
  async NextNonce(
    nextChainNonce: BigNumber,
    publicKey: string,
  ): Promise<BigNumber> {
    const candidates = [
      nextChainNonce,
      await this.readyTxTable.nextNonceOf(publicKey),
      this.NextUnconfirmedNonce(publicKey),
    ];

    return candidates.reduce(bigMax);
  }

  /**
   * Move any future txs for the given public key that have become ready into
   * ready txs. These future txs can share nonces, so we also pick the txs with
   * the best rewards here to ensure duplicate nonces don't reach ready txs.
   */
  async tryMoveFutureTxs(
    publicKey: string,
    nextNonce: BigNumber,
  ) {
    let needNextBatch: boolean;

    do {
      const txsToAdd: TransactionData[] = [];

      const futureTxs = await this.futureTxTable.publicKeyTxsInNonceOrder(
        publicKey,
        this.config.txQueryLimit,
      );

      const bestFutureTxs = groupByNonce(futureTxs)
        .map((txGroup) => this.pickBestReward(txGroup.elements));

      for (const tx of bestFutureTxs) {
        if (tx.nonce.lt(nextNonce)) {
          await this.replaceReadyTx(nextNonce, tx);
        } else if (tx.nonce.eq(nextNonce)) {
          txsToAdd.push(tx);
          nextNonce = nextNonce.add(1);
        } else {
          break;
        }
      }

      const futureTxsToRemove = futureTxs.filter((tx) =>
        tx.nonce.lt(nextNonce)
      );

      await this.readyTxTable.addWithNewId(...txsToAdd);
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
        this.emit({
          type: "warning",
          data: "Future txs unexpectedly empty when it seemed to need pruning",
        });

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
    nextNonce: BigNumber,
    newTx: TransactionData,
  ): Promise<AddTransactionFailure[]> {
    const existingTx = await this.readyTxTable.find(
      newTx.publicKey,
      newTx.nonce,
    );

    if (existingTx === nil) {
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

    const latestReadyNonce = nextNonce.sub(1);
    const causedUnorderedReadyTxs = newTx.nonce.lt(latestReadyNonce);

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
        newTx.publicKey,
        lastNonceReplaced,
        this.config.txQueryLimit,
      );

      if (followupTxs.length === 0) {
        break;
      }

      for (const tx of followupTxs) {
        this.readyTxTable.remove(tx);
        this.readyTxTable.addWithNewId(tx);
      }

      lastNonceReplaced = followupTxs[followupTxs.length - 1].nonce;

      // If followupTxs is under the query limit, then we know there aren't any
      // more followups to process. Otherwise, we need to get more txs from the
      // database and keep going.
      finished = followupTxs.length < this.config.txQueryLimit;
    } while (!finished);

    await Promise.all(promises);
  }

  async removeFromReady(txs: TxTableRow[]) {
    this.readyTxTable.remove(...txs);

    await Promise.all(
      PublicKeys(txs).map((pk) =>
        this.demoteNoLongerReadyTxs(
          pk,
          txs.find((tx) => tx.publicKey === pk)!,
        )
      ),
    );
  }

  async demoteNoLongerReadyTxs(
    /** Public key this operation applies to */
    publicKey: string,
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

    const nextChainNonce = (await this.walletService.checkTx(exampleTx))
      .nextNonce;

    const nextUnconfirmedNonce = this.NextUnconfirmedNonce(publicKey);

    // Ready tx nonces are not included here because it is those very txs that
    // we may be demoting.
    let nextNonce = bigMax(nextChainNonce, nextUnconfirmedNonce);

    let finished: boolean;
    let txs: TransactionData[];

    // Start by finding after one less than the next nonce, so that the first
    // result returned is the next nonce if it is available. This allows us to
    // increment nextNonce and allow readyTxs that are not gapped to stay in
    // ready.
    let findAfterNonce = nextNonce.sub(1);

    do {
      txs = await this.readyTxTable.findAfter(
        publicKey,
        findAfterNonce,
        this.config.txQueryLimit,
      );

      if (txs.length === 0) {
        break;
      }

      for (const tx of txs) {
        if (tx.nonce.eq(nextNonce)) {
          nextNonce = nextNonce.add(1);
        } else {
          promises.push(
            this.readyTxTable.remove(tx),
            this.futureTxTable.addWithNewId(tx),
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
    this.batchesInProgress++;

    const batchResult = await this.runQueryGroup(async () => {
      const priorityTxs = await this.readyTxTable.getHighestPriority(
        this.config.txQueryLimit,
      );

      const publicKeys = PublicKeys(priorityTxs);

      const rewardBalances = Object.fromEntries(
        await Promise.all(publicKeys.map(async (pk) => [
          pk,
          await this.walletService.getRewardBalanceOf(pk),
        ])),
      );

      const batchTxs: TxTableRow[] = [];
      const insufficientRewardTxs: TxTableRow[] = [];
      const gappedPublicKeys: string[] = [];

      for (const tx of priorityTxs) {
        if (gappedPublicKeys.includes(tx.publicKey)) {
          continue;
        }

        if (rewardBalances[tx.publicKey].gte(tx.tokenRewardAmount)) {
          batchTxs.push(tx);

          rewardBalances[tx.publicKey] = rewardBalances[tx.publicKey]
            .sub(tx.tokenRewardAmount);
        } else {
          insufficientRewardTxs.push(tx);
          gappedPublicKeys.push(tx.publicKey);
        }

        if (batchTxs.length >= this.config.maxAggregationSize) {
          break;
        }
      }

      if (batchTxs.length > 0) {
        const maxUnconfirmedTxs = (
          this.config.maxUnconfirmedAggregations *
          this.config.maxAggregationSize
        );

        while (
          this.unconfirmedTxs.size + batchTxs.length > maxUnconfirmedTxs
        ) {
          // FIXME: Polling
          this.emit({ type: "waiting-unconfirmed-space" });
          await delay(1000);
        }

        for (const tx of batchTxs) {
          this.unconfirmedTxs.add(tx);
        }

        (async () => {
          try {
            const recpt = await this.walletService.sendTxs(
              batchTxs,
              Infinity,
              300,
            );

            this.emit({
              type: "batch-confirmed",
              data: {
                txIds: batchTxs.map((tx) => tx.txId),
                blockNumber: recpt.blockNumber,
              },
            });
          } finally {
            for (const tx of batchTxs) {
              this.unconfirmedTxs.delete(tx);
            }
          }
        })();
      }

      await this.removeFromReady([...batchTxs, ...insufficientRewardTxs]);
    });

    this.batchesInProgress--;
    this.checkReadyTxCount();

    return batchResult;
  }

  async waitForConfirmations() {
    const startUnconfirmedTxs = [...this.unconfirmedTxs];

    while (true) {
      const allConfirmed = startUnconfirmedTxs.every(
        (tx) => !this.unconfirmedTxs.has(tx),
      );

      if (allConfirmed) {
        break;
      }

      // FIXME: Polling
      await delay(100);
    }
  }
}

function PublicKeys(txs: TransactionData[]) {
  return Object.keys(Object.fromEntries(txs.map((tx) => [tx.publicKey])));
}

function bigMax(a: BigNumber, b: BigNumber) {
  return a.gt(b) ? a : b;
}

function groupByNonce(txs: TxTableRow[]) {
  return groupBy(txs, (tx) => tx.nonce, (a, b) => a.eq(b));
}
