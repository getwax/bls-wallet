import {
  BigNumber,
  BlsWalletSigner,
  BlsWalletWrapper,
  Bundle,
  delay,
  ethers,
  Semaphore,
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
import plus from "./helpers/plus.ts";
import AggregationStrategy from "./AggregationStrategy.ts";
import nil from "../helpers/nil.ts";

export type AddBundleResponse = { hash: string } | {
  failures: TransactionFailure[];
};

export default class BundleService {
  static defaultConfig = {
    bundleQueryLimit: env.BUNDLE_QUERY_LIMIT,
    breakevenOperationCount: env.BREAKEVEN_OPERATION_COUNT,
    maxAggregationDelayMillis: env.MAX_AGGREGATION_DELAY_MILLIS,
    maxUnconfirmedAggregations: env.MAX_UNCONFIRMED_AGGREGATIONS,
    maxEligibilityDelay: env.MAX_ELIGIBILITY_DELAY,
  };

  unconfirmedBundles = new Set<Bundle>();
  unconfirmedActionCount = 0;
  unconfirmedRowIds = new Set<number>();

  submissionSemaphore: Semaphore;
  submissionTimer: SubmissionTimer;
  submissionsInProgress = 0;

  stopping = false;
  stopped = false;
  pendingTaskPromises = new Set<Promise<unknown>>();

  constructor(
    public emit: (evt: AppEvent) => void,
    public clock: IClock,
    public bundleTableMutex: Mutex,
    public bundleTable: BundleTable,
    public blsWalletSigner: BlsWalletSigner,
    public ethereumService: EthereumService,
    public aggregationStrategy: AggregationStrategy,
    public config = BundleService.defaultConfig,
  ) {
    this.submissionSemaphore = new Semaphore(config.maxUnconfirmedAggregations);

    this.submissionTimer = new SubmissionTimer(
      clock,
      config.maxAggregationDelayMillis,
      () => this.runSubmission(),
    );

    this.ethereumService.provider.on("block", this.handleBlock);
  }

  handleBlock = () => {
    this.addTask(() => this.tryAggregating());
  };

  async stop() {
    this.stopping = true;
    this.ethereumService.provider.off("block", this.handleBlock);
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

    const eligibleRows = this.bundleTable.findEligible(
      await this.ethereumService.BlockNumber(),
      this.config.bundleQueryLimit,
    );

    const opCount = eligibleRows
      .filter((r) => !this.unconfirmedRowIds.has(r.id))
      .map((r) => r.bundle.operations.length)
      .reduce(plus, 0);

    if (opCount >= this.config.breakevenOperationCount) {
      this.submissionTimer.trigger();
    } else if (opCount > 0) {
      this.submissionTimer.notifyActive();
    } else {
      this.submissionTimer.clear();
    }
  }

  runQueryGroup<T>(body: () => Promise<T>): Promise<T> {
    return runQueryGroup(
      this.emit,
      (sql) => this.bundleTable.dbQuery(sql),
      this.bundleTableMutex,
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

    const walletAddresses = await Promise.all(bundle.senderPublicKeys.map(
      (pubKey) =>
        BlsWalletWrapper.AddressFromPublicKey(
          pubKey,
          this.ethereumService.verificationGateway,
        ),
    ));

    const failures: TransactionFailure[] = [];

    for (const walletAddr of walletAddresses) {
      const signedCorrectly = this.blsWalletSigner.verify(bundle, walletAddr);
      if (!signedCorrectly) {
        failures.push({
          type: "invalid-signature",
          description: `invalid signature for wallet address ${walletAddr}`,
        });
      }
    }

    failures.push(...await this.ethereumService.checkNonces(bundle));

    if (failures.length > 0) {
      return { failures };
    }

    return await this.runQueryGroup(async () => {
      const hash = makeHash();

      this.bundleTable.add({
        status: "pending",
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

  lookupBundle(hash: string) {
    return this.bundleTable.findBundle(hash);
  }

  receiptFromBundle(bundle: BundleRow) {
    if (!bundle.receipt) {
      return nil;
    }

    const { receipt, hash } = bundle;

    return {
      bundleHash: hash,
      to: receipt.to,
      from: receipt.from,
      contractAddress: receipt.contractAddress,
      transactionIndex: receipt.transactionIndex,
      root: receipt.root,
      gasUsed: receipt.gasUsed,
      logsBloom: receipt.logsBloom,
      blockHash: receipt.blockHash,
      transactionHash: receipt.transactionHash,
      logs: receipt.logs,
      blockNumber: receipt.blockNumber,
      confirmations: receipt.confirmations,
      cumulativeGasUsed: receipt.cumulativeGasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      byzantium: receipt.byzantium,
      type: receipt.type,
      status: receipt.status,
    };
  }

  async runSubmission() {
    this.submissionsInProgress++;

    const bundleSubmitted = await this.runQueryGroup(async () => {
      const currentBlockNumber = await this.ethereumService.BlockNumber();

      let eligibleRows = this.bundleTable.findEligible(
        currentBlockNumber,
        this.config.bundleQueryLimit,
      );

      // Exclude rows that are already pending.
      eligibleRows = eligibleRows.filter(
        (row) => !this.unconfirmedRowIds.has(row.id),
      );

      this.emit({
        type: "running-strategy",
        data: {
          eligibleRows: eligibleRows.length,
        },
      });

      const {
        aggregateBundle,
        includedRows,
        bundleOverheadCost,
        expectedFee,
        expectedMaxCost,
        failedRows,
      } = await this
        .aggregationStrategy.run(eligibleRows);

      this.emit({
        type: "completed-strategy",
        data: {
          includedRows: includedRows.length,
          bundleOverheadCost: ethers.utils.formatEther(bundleOverheadCost),
          expectedFee: ethers.utils.formatEther(expectedFee),
          expectedMaxCost: ethers.utils.formatEther(expectedMaxCost),
        },
      });

      for (const failedRow of failedRows) {
        this.emit({
          type: "failed-row",
          data: {
            publicKeyShorts: failedRow.bundle.senderPublicKeys.map(
              toShortPublicKey,
            ),
            submitError: failedRow.submitError,
          },
        });

        this.handleFailedRow(failedRow, currentBlockNumber);
      }

      if (!aggregateBundle || includedRows.length === 0) {
        return false;
      }

      await this.submitAggregateBundle(
        aggregateBundle,
        includedRows,
        expectedFee,
        expectedMaxCost,
      );

      return true;
    });

    this.submissionsInProgress--;

    if (bundleSubmitted) {
      this.addTask(() => this.tryAggregating());
    }
  }

  handleFailedRow(row: BundleRow, currentBlockNumber: BigNumber) {
    if (row.nextEligibilityDelay.lte(this.config.maxEligibilityDelay)) {
      this.bundleTable.update({
        ...row,
        eligibleAfter: currentBlockNumber.add(row.nextEligibilityDelay),
        nextEligibilityDelay: row.nextEligibilityDelay.mul(2),
      });
    } else {
      this.bundleTable.update({
        ...row,
        status: "failed",
      });
    }

    this.unconfirmedRowIds.delete(row.id);
  }

  async submitAggregateBundle(
    aggregateBundle: Bundle,
    includedRows: BundleRow[],
    expectedFee: BigNumber,
    expectedMaxCost: BigNumber,
  ) {
    const releaseSemaphore = await this.submissionSemaphore.acquire();
    this.unconfirmedBundles.add(aggregateBundle);

    for (const row of includedRows) {
      this.unconfirmedRowIds.add(row.id);
    }

    this.addTask(async () => {
      try {
        const balanceBefore = await this.ethereumService.wallet.getBalance();

        const receipt = await this.ethereumService.submitBundle(
          aggregateBundle,
          Infinity,
          300,
        );

        const balanceAfter = await this.ethereumService.wallet.getBalance();

        for (const row of includedRows) {
          this.bundleTable.update({
            ...row,
            receipt,
            status: "confirmed",
          });
        }

        const profit = balanceAfter.sub(balanceBefore);

        /** What we paid to process the bundle */
        const cost = receipt.gasUsed.mul(receipt.effectiveGasPrice);

        /** Fees collected from users */
        const actualFee = profit.add(cost);

        this.emit({
          type: "submission-confirmed",
          data: {
            hash: receipt.transactionHash,
            bundleHashes: includedRows.map((row) => row.hash),
            blockNumber: receipt.blockNumber,
            profit: ethers.utils.formatEther(profit),
            cost: ethers.utils.formatEther(cost),
            expectedMaxCost: ethers.utils.formatEther(expectedMaxCost),
            actualFee: ethers.utils.formatEther(actualFee),
            expectedFee: ethers.utils.formatEther(expectedFee),
          },
        });
      } finally {
        this.unconfirmedBundles.delete(aggregateBundle);

        for (const row of includedRows) {
          this.unconfirmedRowIds.delete(row.id);
        }

        releaseSemaphore();
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
