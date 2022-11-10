import {
  BigNumber,
  BlsWalletSigner,
  Bundle,
  delay,
  ethers,
  QueryClient,
} from "../../deps.ts";

import { IClock } from "../helpers/Clock.ts";
import Mutex from "../helpers/Mutex.ts";
import toShortPublicKey from "./helpers/toPublicKeyShort.ts";

import TransactionFailure from "./TransactionFailure.ts";
import SubmissionTimer from "./SubmissionTimer.ts";
import * as env from "../env.ts";
import runQueryGroup from "./runQueryGroup.ts";
import EthereumService from "./EthereumService.ts";
import AppEvent from "./AppEvent.ts";
import BundleTable, { BundleRow, makeHash } from "./BundleTable.ts";
import countActions from "./helpers/countActions.ts";
import plus from "./helpers/plus.ts";
import AggregationStrategy from "./AggregationStrategy.ts";
import nil from "../helpers/nil.ts";

export type AddBundleResponse = { hash: string } | { failures: TransactionFailure[] };

export default class BundleService {
  static defaultConfig = {
    bundleQueryLimit: env.BUNDLE_QUERY_LIMIT,
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    maxAggregationDelayMillis: env.MAX_AGGREGATION_DELAY_MILLIS,
    maxUnconfirmedAggregations: env.MAX_UNCONFIRMED_AGGREGATIONS,
    maxEligibilityDelay: env.MAX_ELIGIBILITY_DELAY,
  };

  unconfirmedBundles = new Set<Bundle>();
  unconfirmedActionCount = 0;
  unconfirmedRowIds = new Set<number>();

  // TODO (merge-ok) use database table in the future to persist
  confirmedBundles = new Map<string, {
    bundle: Bundle,
    receipt: ethers.ContractReceipt,
  }>();

  submissionTimer: SubmissionTimer;
  submissionsInProgress = 0;

  stopping = false;
  stopped = false;
  pendingTaskPromises = new Set<Promise<unknown>>();

  constructor(
    public emit: (evt: AppEvent) => void,
    public clock: IClock,
    public queryClient: QueryClient,
    public bundleTableMutex: Mutex,
    public bundleTable: BundleTable,
    public blsWalletSigner: BlsWalletSigner,
    public ethereumService: EthereumService,
    public aggregationStrategy: AggregationStrategy,
    public config = BundleService.defaultConfig,
  ) {
    this.submissionTimer = new SubmissionTimer(
      clock,
      config.maxAggregationDelayMillis,
      () => this.runSubmission(),
    );

    (async () => {
      await delay(100);

      while (!this.stopping) {
        this.tryAggregating();
        // TODO (merge-ok): Stop if there aren't any bundles?
        await this.ethereumService.waitForNextBlock();
      }
    })();
  }

  async stop() {
    this.stopping = true;
    await Promise.all(Array.from(this.pendingTaskPromises));
    this.stopped = true;
  }

  async runPendingTasks() {
    while (this.pendingTaskPromises.size > 0) {
      await Promise.all(Array.from(this.pendingTaskPromises));
    }
  }

  addTask(task: () => Promise<unknown>) {
    if (this.stopping) {
      return;
    }

    const promise = task().catch(() => {});
    this.pendingTaskPromises.add(promise);
    promise.then(() => this.pendingTaskPromises.delete(promise));
  }

  async tryAggregating() {
    if (this.submissionsInProgress > 0) {
      // No need to check because there is already a submission in progress, and
      // a new check is run after every submission.
      return;
    }

    const eligibleRows = await this.bundleTable.findEligible(
      await this.ethereumService.BlockNumber(),
      this.config.bundleQueryLimit,
    );

    const actionCount = eligibleRows
      .filter((r) => !this.unconfirmedRowIds.has(r.id))
      .map((r) => countActions(r.bundle))
      .reduce(plus, 0);

    if (actionCount >= this.config.maxAggregationSize) {
      this.submissionTimer.trigger();
    } else if (actionCount > 0) {
      this.submissionTimer.notifyActive();
    } else {
      this.submissionTimer.clear();
    }
  }

  runQueryGroup<T>(body: () => Promise<T>): Promise<T> {
    return runQueryGroup(
      this.emit,
      this.bundleTableMutex,
      this.queryClient,
      body,
    );
  }

  async add(
    bundle: Bundle,
  ): Promise<AddBundleResponse> {
    if (bundle.operations.length !== bundle.senderPublicKeys.length) {
      return {
        failures: [
          {
            type: "invalid-format",
            description:
              "number of operations does not match number of public keys",
          },
        ],
      };
    }

    const signedCorrectly = this.blsWalletSigner.verify(bundle);

    const failures: TransactionFailure[] = [];

    if (signedCorrectly === false) {
      failures.push({
        type: "invalid-signature",
        description: "invalid signature",
      });
    }

    failures.push(...await this.ethereumService.checkNonces(bundle));

    if (failures.length > 0) {
      return { failures };
    }

    return await this.runQueryGroup(async () => {
      const hash = makeHash();

      await this.bundleTable.add({
        hash,
        bundle,
        eligibleAfter: await this.ethereumService.BlockNumber(),
        nextEligibilityDelay: BigNumber.from(1),
      });

      this.emit({
        type: "bundle-added",
        data: {
          hash,
          publicKeyShorts: bundle.senderPublicKeys.map(toShortPublicKey),
        },
      });

      this.addTask(() => this.tryAggregating());

      return { hash };
    });
  }

  // TODO (merge-ok) Remove lint ignore when this hits db
  // deno-lint-ignore require-await
  async lookupReceipt(hash: string) {
    const confirmation = this.confirmedBundles.get(hash);

    if (!confirmation) {
      return nil;
    }

    const receipt = confirmation.receipt;

    return {
      transactionIndex: receipt.transactionIndex,
      transactionHash: receipt.transactionHash,
      bundleHash: hash,
      blockHash: receipt.blockHash,
      blockNumber: receipt.blockNumber,
      // TODO: Messing around with returning the receipt type that ethers expects 
      // to: receipt.to,
      // from: receipt.from,
      // contractAddress: receipt.contractAddress,
      // transactionIndex: receipt.transactionIndex,
      // gasUsed: receipt.gasUsed,
      // logsBloom: receipt.logsBloom,
      // blockHash: receipt.blockHash,
      // transactionHash: receipt.transactionHash,
      // logs: receipt.logs,
      // blockNumber: receipt.blockNumber,
      // confirmations: receipt.confirmations,
      // cumulativeGasUsed: receipt.cumulativeGasUsed,
      // effectiveGasPrice: receipt.effectiveGasPrice,
      // byzantium: receipt.byzantium,
      // type: receipt.type,
      // bundleHash: hash,
      // BlockHash: receipt.blockHash,
    };
  }

  async runSubmission() {
    this.submissionsInProgress++;

    const submissionResult = await this.runQueryGroup(async () => {
      const currentBlockNumber = await this.ethereumService.BlockNumber();

      let eligibleRows = await this.bundleTable.findEligible(
        currentBlockNumber,
        this.config.bundleQueryLimit,
      );

      // Exclude rows that are already pending.
      eligibleRows = eligibleRows.filter(
        (row) => !this.unconfirmedRowIds.has(row.id),
      );

      const { aggregateBundle, includedRows, failedRows } = await this
        .aggregationStrategy.run(eligibleRows);

      for (const failedRow of failedRows) {
        await this.handleFailedRow(failedRow, currentBlockNumber);
      }

      if (!aggregateBundle || includedRows.length === 0) {
        return;
      }

      await this.submitAggregateBundle(
        aggregateBundle,
        includedRows,
      );
    });

    this.submissionsInProgress--;
    this.addTask(() => this.tryAggregating());

    return submissionResult;
  }

  async handleFailedRow(row: BundleRow, currentBlockNumber: BigNumber) {
    if (row.nextEligibilityDelay.lte(this.config.maxEligibilityDelay)) {
      await this.bundleTable.update({
        ...row,
        eligibleAfter: currentBlockNumber.add(row.nextEligibilityDelay),
        nextEligibilityDelay: row.nextEligibilityDelay.mul(2),
      });
    } else {
      await this.bundleTable.remove(row);
    }

    this.unconfirmedRowIds.delete(row.id);
  }

  async submitAggregateBundle(
    aggregateBundle: Bundle,
    includedRows: BundleRow[],
  ) {
    const maxUnconfirmedActions = (
      this.config.maxUnconfirmedAggregations *
      this.config.maxAggregationSize
    );

    const actionCount = countActions(aggregateBundle);

    while (
      this.unconfirmedActionCount + actionCount > maxUnconfirmedActions
    ) {
      // FIXME (merge-ok): Polling
      this.emit({ type: "waiting-unconfirmed-space" });
      await delay(1000);
    }

    this.unconfirmedActionCount += actionCount;
    this.unconfirmedBundles.add(aggregateBundle);

    for (const row of includedRows) {
      this.unconfirmedRowIds.add(row.id);
    }

    this.addTask(async () => {
      try {
        const receipt = await this.ethereumService.submitBundle(
          aggregateBundle,
          Infinity,
          300,
        );

        for (const row of includedRows) {
          this.confirmedBundles.set(row.hash, {
            bundle: row.bundle,
            receipt,
          });
        }

        this.emit({
          type: "submission-confirmed",
          data: {
            hash: receipt.transactionHash,
            bundleHashes: includedRows.map((row) => row.hash),
            blockNumber: receipt.blockNumber,
          },
        });

        await this.bundleTable.remove(...includedRows);
      } finally {
        this.unconfirmedActionCount -= actionCount;
        this.unconfirmedBundles.delete(aggregateBundle);

        for (const row of includedRows) {
          this.unconfirmedRowIds.delete(row.id);
        }
      }
    });
  }

  async waitForConfirmations() {
    const startUnconfirmedBundles = [...this.unconfirmedBundles];

    while (true) {
      const allConfirmed = startUnconfirmedBundles.every(
        (bundle) => !this.unconfirmedBundles.has(bundle),
      );

      if (allConfirmed) {
        break;
      }

      // FIXME (merge-ok): Polling
      await delay(100);
    }
  }
}
