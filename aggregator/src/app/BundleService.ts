import {
  BigNumber,
  BlsWalletSigner,
  Bundle,
  delay,
  ERC20,
  ERC20__factory,
  ethers,
  QueryClient,
} from "../../deps.ts";

import { IClock } from "../helpers/Clock.ts";
import Mutex from "../helpers/Mutex.ts";
import toShortPublicKey from "./helpers/toPublicKeyShort.ts";
import nil from "../helpers/nil.ts";
import Range from "../helpers/Range.ts";
import assert from "../helpers/assert.ts";

import TransactionFailure from "./TransactionFailure.ts";
import SubmissionTimer from "./SubmissionTimer.ts";
import * as env from "../env.ts";
import runQueryGroup from "./runQueryGroup.ts";
import EthereumService from "./EthereumService.ts";
import AppEvent from "./AppEvent.ts";
import BundleTable, { BundleRow } from "./BundleTable.ts";

export default class BundleService {
  static defaultConfig = {
    bundleQueryLimit: env.BUNDLE_QUERY_LIMIT,
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    maxAggregationDelayMillis: env.MAX_AGGREGATION_DELAY_MILLIS,
    maxUnconfirmedAggregations: env.MAX_UNCONFIRMED_AGGREGATIONS,
    maxEligibilityDelay: env.MAX_ELIGIBILITY_DELAY,
    fees: {
      type: env.FEE_TYPE,
      perGas: env.FEE_PER_GAS,
      perByte: env.FEE_PER_BYTE,
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

    const eligibleRows = await this.bundleTable.findEligible(
      await this.ethereumService.BlockNumber(),
      this.config.bundleQueryLimit,
    );

    const actionCount = eligibleRows
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

      let eligibleRows = await this.bundleTable.findEligible(
        currentBlockNumber,
        this.config.bundleQueryLimit,
      );

      // Exclude rows that are already pending.
      eligibleRows = eligibleRows.filter(
        (row) => !this.unconfirmedRowIds.has(row.id!),
      );

      const { aggregateBundle, includedRows, failedRows } = await this
        .createAggregateBundle(eligibleRows);

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

  async createAggregateBundle(eligibleRows: BundleRow[]): (
    Promise<{
      aggregateBundle: Bundle | nil;
      includedRows: BundleRow[];
      failedRows: BundleRow[];
    }>
  ) {
    let aggregateBundle = this.blsWalletSigner.aggregate([]);
    const includedRows: BundleRow[] = [];
    const failedRows: BundleRow[] = [];

    while (eligibleRows.length > 0) {
      const {
        aggregateBundle: newAggregateBundle,
        includedRows: newIncludedRows,
        failedRows: newFailedRows,
        remainingEligibleRows,
      } = await this.augmentAggregateBundle(
        aggregateBundle,
        eligibleRows,
      );

      aggregateBundle = newAggregateBundle;
      includedRows.push(...newIncludedRows);
      failedRows.push(...newFailedRows);
      eligibleRows = remainingEligibleRows;
    }

    return {
      aggregateBundle: aggregateBundle.operations.length > 0
        ? aggregateBundle
        : nil,
      includedRows,
      failedRows,
    };
  }

  async augmentAggregateBundle(
    previousAggregateBundle: Bundle,
    eligibleRows: BundleRow[],
  ): (
    Promise<{
      aggregateBundle: Bundle;
      includedRows: BundleRow[];
      failedRows: BundleRow[];
      remainingEligibleRows: BundleRow[];
    }>
  ) {
    let aggregateBundle: Bundle | nil = nil;
    let includedRows: BundleRow[] = [];
    const failedRows: BundleRow[] = [];
    // TODO (merge-ok): Count gas instead, have idea
    // or way to query max gas per txn (submission).
    let actionCount = countActions(previousAggregateBundle);

    for (const row of eligibleRows) {
      const rowActionCount = countActions(row.bundle);

      if (actionCount + rowActionCount > this.config.maxAggregationSize) {
        break;
      }

      includedRows.push(row);
      actionCount += rowActionCount;
    }

    const [previousFee, ...fees] = (await this.measureFees([
      previousAggregateBundle,
      ...includedRows.map((r) => r.bundle),
    ]));

    const firstFailureIndex = await this.findFirstFailureIndex(
      previousAggregateBundle,
      previousFee,
      includedRows.map((r) => r.bundle),
      fees,
    );

    let remainingEligibleRows: BundleRow[];

    if (firstFailureIndex !== nil) {
      const failedRow = includedRows[firstFailureIndex];
      failedRows.push(failedRow);

      includedRows = includedRows.slice(
        0,
        firstFailureIndex,
      );

      const eligibleRowIndex = eligibleRows.indexOf(failedRow);
      assert(eligibleRowIndex !== -1);

      remainingEligibleRows = eligibleRows.slice(includedRows.length + 1);
    } else {
      remainingEligibleRows = eligibleRows.slice(includedRows.length);
    }

    aggregateBundle = this.blsWalletSigner.aggregate([
      previousAggregateBundle,
      ...includedRows.map((r) => r.bundle),
    ]);

    return {
      aggregateBundle,
      includedRows,
      failedRows,
      remainingEligibleRows,
    };
  }

  async measureFees(bundles: Bundle[]): Promise<{
    success: boolean;
    fee: BigNumber;
  }[]> {
    const es = this.ethereumService;
    const feeToken = this.FeeToken();

    const { measureResults, callResults: processBundleResults } = await es
      .callStaticSequenceWithMeasure(
        feeToken
          ? es.Call(feeToken, "balanceOf", [es.wallet.address])
          : es.Call(es.utilities, "ethBalanceOf", [es.wallet.address]),
        bundles.map((bundle) =>
          es.Call(
            es.verificationGateway,
            "processBundle",
            [bundle],
          )
        ),
      );

    return Range(bundles.length).map((i) => {
      const [before, after] = [measureResults[i], measureResults[i + 1]];
      assert(before.success);
      assert(after.success);

      const bundleResult = processBundleResults[i];

      let success: boolean;

      if (bundleResult.success) {
        const [operationResults] = bundleResult.returnValue;

        // We require that at least one operation succeeds, even though
        // processBundle doesn't revert in this case.
        success = operationResults.some((opSuccess) => opSuccess === true);
      } else {
        success = false;
      }

      const fee = after.returnValue[0].sub(before.returnValue[0]);

      return { success, fee };
    });
  }

  FeeToken(): ERC20 | nil {
    const feeType = this.config.fees.type;

    if (feeType === "ether") {
      return nil;
    }

    return ERC20__factory.connect(
      feeType.slice("token:".length),
      this.ethereumService.wallet.provider,
    );
  }

  async measureRequiredFee(bundle: Bundle) {
    const gasEstimate = await this.ethereumService.verificationGateway
      .estimateGas
      .processBundle(bundle);

    const callDataSize = ethers.utils.hexDataLength(
      this.ethereumService.verificationGateway.interface
        .encodeFunctionData("processBundle", [bundle]),
    );

    return (
      gasEstimate.mul(this.config.fees.perGas).add(
        this.config.fees.perByte.mul(callDataSize),
      )
    );
  }

  /**
   * Get a lower bound for the fee that is required for processing the
   * bundle.
   *
   * This exists because it's a very good lower bound and it's very fast.
   * Therefore, when there's an insufficient fee bundle:
   * - This lower bound is usually enough to find it
   * - Finding it this way is much more efficient
   */
  measureRequiredFeeLowerBound(bundle: Bundle) {
    const callDataEmptyBundleSize = ethers.utils.hexDataLength(
      this.ethereumService.verificationGateway.interface
        .encodeFunctionData("processBundle", [
          this.blsWalletSigner.aggregate([]),
        ]),
    );

    const callDataSize = ethers.utils.hexDataLength(
      this.ethereumService.verificationGateway.interface
        .encodeFunctionData("processBundle", [bundle]),
    );

    // We subtract the size of an empty bundle because it represents the number
    // of *additional* bytes added when aggregating. The bundle doesn't
    // necessarily have to pay the initial overhead to be viable.
    const callDataMarginalSize = callDataSize - callDataEmptyBundleSize;

    return this.config.fees.perByte.mul(callDataMarginalSize);
  }

  async findFirstFailureIndex(
    previousAggregateBundle: Bundle,
    previousFee: { success: boolean; fee: BigNumber },
    bundles: Bundle[],
    fees: { success: boolean; fee: BigNumber }[],
  ): Promise<number | nil> {
    if (bundles.length === 0) {
      return nil;
    }

    const len = bundles.length;
    assert(fees.length === len);

    const checkFirstN = async (n: number): Promise<{
      success: boolean;
      fee: BigNumber;
      requiredFee: BigNumber;
    }> => {
      if (n === 0) {
        return {
          success: true,
          fee: BigNumber.from(0),
          requiredFee: BigNumber.from(0),
        };
      }

      const fee = bigSum([
        previousFee.fee,
        ...fees.slice(0, n).map((r) => r.fee),
      ]);

      const requiredFee = await this.measureRequiredFee(
        this.blsWalletSigner.aggregate([
          previousAggregateBundle,
          ...bundles.slice(0, n),
        ]),
      );

      const success = fee.gte(requiredFee);

      return { success, fee, requiredFee };
    };

    // This calculation is entirely local and cheap. It can find a failing
    // bundle, but it might not be the *first* failing bundle.
    const fastFailureIndex = (() => {
      for (let i = 0; i < len; i++) {
        // If the actual call failed then we consider it a failure, even if the
        // fee is somehow met (e.g. if zero fee is required).
        if (fees[i].success === false) {
          return i;
        }

        // Because the required fee mostly comes from the calldata size, this
        // should find the first insufficient fee most of the time.
        const lowerBound = this.measureRequiredFeeLowerBound(bundles[i]);

        if (fees[i].fee.lt(lowerBound)) {
          return i;
        }
      }
    })();

    let left = 0;
    let leftRequiredFee = BigNumber.from(0);
    let right: number;
    let rightRequiredFee: BigNumber;

    if (fastFailureIndex !== nil) {
      // Having a fast failure index is not enough because it might not be the
      // first. To establish that it really is the first, we need to ensure that
      // all bundles up to that index are ok (indeed, this is the assumption
      // that is relied upon outside - that the subset before the first failing
      // index can proceed without further checking).

      const { success, requiredFee } = await checkFirstN(fastFailureIndex);

      if (success) {
        return fastFailureIndex;
      }

      // In case of failure, we now know there as a failing index in a more
      // narrow range, so we can at least restrict the bisect to this smaller
      // range.
      right = fastFailureIndex;
      rightRequiredFee = requiredFee;
    } else {
      // If we don't have a failing index, we still need to establish that there
      // is a failing index to be found. This is because it's a requirement of
      // the upcoming bisect logic that there is a failing bundle in
      // `bundles.slice(left, right)`.

      const { success, requiredFee } = await checkFirstN(bundles.length);

      if (success) {
        return nil;
      }

      right = bundles.length;
      rightRequiredFee = requiredFee;
    }

    // Do a bisect to narrow in on the (first) culprit.
    while (right - left > 1) {
      const mid = Math.floor((left + right) / 2);

      const { success, requiredFee } = await checkFirstN(mid);

      if (success) {
        left = mid;
        leftRequiredFee = requiredFee;
      } else {
        right = mid;
        rightRequiredFee = requiredFee;
      }
    }

    assert(right - left === 1, "bisect should identify a single result");

    // The bisect procedure maintains that the culprit is a member of
    // `bundles.slice(left, right)`. That's now equivalent to `[bundles[left]]`,
    // so `left` is our culprit index.

    const bundleFee = fees[left].fee;
    const bundleRequiredFee = rightRequiredFee.sub(leftRequiredFee);

    // Tracking the fees so that we can include this assertion isn't strictly
    // necessary. But the cost is negligible and should help troubleshooting a
    // lot if something goes wrong.
    assert(bundleFee.lt(bundleRequiredFee));

    return left;
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
