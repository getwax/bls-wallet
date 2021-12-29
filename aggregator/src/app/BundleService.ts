import {
  BigNumber,
  BlsWalletSigner,
  Bundle,
  delay,
  QueryClient,
} from "../../deps.ts";
import { IClock } from "../helpers/Clock.ts";
import Mutex from "../helpers/Mutex.ts";

import TransactionFailure from "./TransactionFailure.ts";
import SubmissionTimer from "./SubmissionTimer.ts";
import * as env from "../env.ts";
import runQueryGroup from "./runQueryGroup.ts";
import EthereumService from "./EthereumService.ts";
import AppEvent from "./AppEvent.ts";
import BundleTable, { BundleRow } from "./BundleTable.ts";
import toShortPublicKey from "./helpers/toPublicKeyShort.ts";

export default class BundleService {
  static defaultConfig = {
    bundleQueryLimit: env.BUNDLE_QUERY_LIMIT,
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    maxAggregationDelayMillis: env.MAX_AGGREGATION_DELAY_MILLIS,
    maxUnconfirmedAggregations: env.MAX_UNCONFIRMED_AGGREGATIONS,
  };

  unconfirmedBundles = new Set<Bundle>();
  unconfirmedActionCount = 0;
  unconfirmedRowIds = new Set<number>();

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

    const eligibleBundleRows = await this.bundleTable.findEligible(
      await this.ethereumService.BlockNumber(),
      this.config.bundleQueryLimit,
    );

    const actionCount = eligibleBundleRows
      .filter((r) => !this.unconfirmedRowIds.has(r.id!))
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

  async add(bundle: Bundle): Promise<TransactionFailure[]> {
    if (bundle.operations.length !== bundle.senderPublicKeys.length) {
      return [
        {
          type: "invalid-format",
          description:
            "number of operations does not match number of public keys",
        },
      ];
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
      return failures;
    }

    return await this.runQueryGroup(async () => {
      await this.bundleTable.add({
        bundle,
        eligibleAfter: await this.ethereumService.BlockNumber(),
        nextEligibilityDelay: BigNumber.from(1),
      });

      this.emit({
        type: "bundle-added",
        data: {
          publicKeyShorts: bundle.senderPublicKeys.map(toShortPublicKey),
        },
      });

      this.addTask(() => this.tryAggregating());

      return [];
    });
  }

  async runSubmission() {
    this.submissionsInProgress++;

    const submissionResult = await this.runQueryGroup(async () => {
      const currentBlockNumber = await this.ethereumService.BlockNumber();

      const eligibleBundleRows = await this.bundleTable.findEligible(
        currentBlockNumber,
        this.config.bundleQueryLimit,
      );

      let aggregateBundle: Bundle | null = null;
      const includedRows: BundleRow[] = [];
      // TODO (merge-ok): Count gas instead, have idea
      // or way to query max gas per txn (submission).
      let actionCount = 0;

      for (const row of eligibleBundleRows) {
        if (this.unconfirmedRowIds.has(row.id!)) {
          continue;
        }

        const rowActionCount = countActions(row.bundle);

        if (actionCount + rowActionCount > this.config.maxAggregationSize) {
          break;
        }

        const candidateBundle = this.blsWalletSigner.aggregate([
          ...(aggregateBundle ? [aggregateBundle] : []),
          row.bundle,
        ]);

        if (await this.ethereumService.checkBundle(candidateBundle)) {
          aggregateBundle = candidateBundle;
          includedRows.push(row);
          actionCount += rowActionCount;
        } else {
          await this.handleFailedRow(row, currentBlockNumber);
        }
      }

      if (!aggregateBundle || includedRows.length === 0) {
        return;
      }

      const maxUnconfirmedActions = (
        this.config.maxUnconfirmedAggregations *
        this.config.maxAggregationSize
      );

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
        this.unconfirmedRowIds.add(row.id!);
      }

      // TODO (merge-ok): Use a task
      (async () => {
        try {
          const recpt = await this.ethereumService.submitBundle(
            aggregateBundle,
            Infinity,
            300,
          );

          this.emit({
            type: "submission-confirmed",
            data: {
              rowIds: includedRows.map((row) => row.id),
              blockNumber: recpt.blockNumber,
            },
          });

          await this.bundleTable.remove(...includedRows);
        } finally {
          this.unconfirmedActionCount -= actionCount;
          this.unconfirmedBundles.delete(aggregateBundle);

          for (const row of includedRows) {
            this.unconfirmedRowIds.delete(row.id!);
          }
        }
      })();
    });

    this.submissionsInProgress--;
    this.addTask(() => this.tryAggregating());

    return submissionResult;
  }

  async handleFailedRow(row: BundleRow, currentBlockNumber: BigNumber) {
    if (row.nextEligibilityDelay.lte(env.MAX_ELIGIBILITY_DELAY)) {
      await this.bundleTable.update({
        ...row,
        eligibleAfter: currentBlockNumber.add(row.nextEligibilityDelay),
        nextEligibilityDelay: row.nextEligibilityDelay.mul(2),
      });
    } else {
      await this.bundleTable.remove(row);
    }

    this.unconfirmedRowIds.delete(row.id!);
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

function countActions(bundle: Bundle) {
  return bundle.operations.map((op) => op.actions.length).reduce(plus, 0);
}

function plus(a: number, b: number) {
  return a + b;
}
