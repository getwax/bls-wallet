import {
  BigNumber,
  BlsWalletSigner,
  Bundle,
  delay,
  ERC20,
  ERC20__factory,
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
import nil from "../helpers/nil.ts";
import Range from "../helpers/Range.ts";

export default class BundleService {
  static defaultConfig = {
    bundleQueryLimit: env.BUNDLE_QUERY_LIMIT,
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    maxAggregationDelayMillis: env.MAX_AGGREGATION_DELAY_MILLIS,
    maxUnconfirmedAggregations: env.MAX_UNCONFIRMED_AGGREGATIONS,
    maxEligibilityDelay: env.MAX_ELIGIBILITY_DELAY,
    rewards: {
      type: env.REWARD_TYPE,
      perGas: env.REWARD_PER_GAS,
      perByte: env.REWARD_PER_BYTE,
    },
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

      const { aggregateBundle, includedRows } = await this
        .createAggregateBundle(
          eligibleBundleRows,
          currentBlockNumber,
        );

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

  async createAggregateBundle(
    eligibleBundleRows: BundleRow[],
    currentBlockNumber: BigNumber,
  ): Promise<
    {
      aggregateBundle: Bundle | nil;
      includedRows: BundleRow[];
    }
  > {
    let aggregateBundle: Bundle | nil = nil;
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

      includedRows.push(row);
      actionCount += rowActionCount;
    }

    aggregateBundle = this.blsWalletSigner.aggregate(
      includedRows.map((r) => r.bundle),
    );

    const rewards = await this.measureRewards(
      includedRows.map((r) => r.bundle),
    );

    const requiredReward = await this.measureRequiredReward(
      this.blsWalletSigner.aggregate(includedRows.map((r) => r.bundle)),
    );

    if (bigSum(rewards).lt(requiredReward)) {
      throw new Error("TODO: Implement this");
    }

    return {
      aggregateBundle,
      includedRows,
    };
  }

  async measureRewards(bundles: Bundle[]): Promise<BigNumber[]> {
    const es = this.ethereumService;

    const rewardToken = this.RewardToken();

    const rawResults = await es.callStaticSequenceWithMeasure(
      // FIXME: There is a griefing attack here. A malicious user could create
      // a transfer that is conditional on tx.origin == utilities. That way it
      // wouldn't actually pay in the real transaction, therefore using our
      // aggregator to pay their gas fees for free.
      // Actually: What is tx.origin when using callStatic?
      rewardToken
        ? es.Call(rewardToken, "balanceOf", [es.utilities.address])
        : es.Call(es.utilities, "ethBalanceOf", [es.utilities.address]),
      bundles.map((bundle) =>
        es.Call(
          es.verificationGateway,
          "processBundle",
          [bundle],
        )
      ),
    );

    return Range(rawResults.length - 1).map((i) => {
      const [[before], [after]] = [rawResults[i], rawResults[i + 1]];

      return after.sub(before);
    });
  }

  RewardToken(): ERC20 | nil {
    const rewardType = this.config.rewards.type;

    if (rewardType === "ether") {
      return nil;
    }

    return ERC20__factory.connect(
      rewardType.slice("token:".length),
      this.ethereumService.wallet.provider,
    );
  }

  async measureRequiredReward(bundle: Bundle) {
    const gasEstimate = await this.ethereumService.verificationGateway
      .estimateGas
      .processBundle(bundle);

    const callDataSize = this.ethereumService.verificationGateway.interface
      .encodeFunctionData("processBundle", [bundle]);

    return (
      gasEstimate.toNumber() * this.config.rewards.perGas +
      callDataSize.length * this.config.rewards.perByte
    );
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

    this.unconfirmedRowIds.delete(row.id!);
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
      this.unconfirmedRowIds.add(row.id!);
    }

    this.addTask(async () => {
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

function countActions(bundle: Bundle) {
  return bundle.operations.map((op) => op.actions.length).reduce(plus, 0);
}

function plus(a: number, b: number) {
  return a + b;
}

function bigSum(values: BigNumber[]) {
  return values.reduce((a, b) => a.add(b), BigNumber.from(0));
}
