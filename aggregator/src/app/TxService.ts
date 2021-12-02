import {
  BigNumber,
  BlsWalletSigner,
  Bundle,
  delay,
  ethers,
  PublicKey,
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
import BundleTable from "./BundleTable.ts";

// TODO: Rename. Maybe "BundlePoolService"?
export default class TxService {
  static defaultConfig = {
    txQueryLimit: env.TX_QUERY_LIMIT,
    maxFutureTxs: env.MAX_FUTURE_TXS,
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    maxAggregationDelayMillis: env.MAX_AGGREGATION_DELAY_MILLIS,
    maxUnconfirmedAggregations: env.MAX_UNCONFIRMED_AGGREGATIONS,
  };

  unconfirmedBundles = new Set<Bundle>();
  unconfirmedActionCount = 0;
  unconfirmedRowIds = new Set<number>();
  submissionTimer: SubmissionTimer;
  submissionsInProgress = 0;

  constructor(
    public emit: (evt: AppEvent) => void,
    public clock: IClock,
    public queryClient: QueryClient,
    public txTablesMutex: Mutex,
    public bundleTable: BundleTable,
    public blsWalletSigner: BlsWalletSigner,
    public ethereumService: EthereumService,
    public config = TxService.defaultConfig,
  ) {
    this.submissionTimer = new SubmissionTimer(
      clock,
      config.maxAggregationDelayMillis,
      () => this.runSubmission(),
    );

    this.tryAggregating();
  }

  async tryAggregating() {
    if (this.submissionsInProgress > 0) {
      // No need to check because there is already a submission in progress, and
      // a new check is run after every submission.
      return;
    }

    const eligibleBundleRows = await this.bundleTable.findEligible(
      await this.ethereumService.BlockNumber(),
      this.config.txQueryLimit,
    );

    const actionCount = (eligibleBundleRows
      .map((r) => countActions(r.bundle))
      .reduce(plus, 0));

    if (actionCount >= this.config.maxAggregationSize) {
      this.submissionTimer.trigger();
    } else if (actionCount > 0) {
      // TODO: tx -> bundle
      this.submissionTimer.notifyTxWaiting();
    } else {
      this.submissionTimer.clear();
    }
  }

  runQueryGroup<T>(body: () => Promise<T>): Promise<T> {
    return runQueryGroup(this.emit, this.txTablesMutex, this.queryClient, body);
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

      this.tryAggregating();

      return [];
    });
  }

  async runSubmission() {
    this.submissionsInProgress++;

    const submissionResult = await this.runQueryGroup(async () => {
      let aggregateBundle: Bundle = {
        signature: [BigNumber.from(0), BigNumber.from(0)],
        senderPublicKeys: [],
        operations: [],
      };

      const eligibleBundleRows = await this.bundleTable.findEligible(
        await this.ethereumService.BlockNumber(),
        this.config.txQueryLimit,
      );

      const includedRows: typeof eligibleBundleRows = [];
      let actionCount = 0; // TODO: Count gas instead?

      for (const row of eligibleBundleRows) {
        if (this.unconfirmedRowIds.has(row.id!)) {
          continue;
        }

        const rowActionCount = countActions(row.bundle);

        if (actionCount + rowActionCount > this.config.maxAggregationSize) {
          break;
        }

        const candidateBundle = this.blsWalletSigner.aggregate([
          aggregateBundle,
          row.bundle,
        ]);

        if (this.ethereumService.checkBundle(candidateBundle)) {
          aggregateBundle = candidateBundle;
          includedRows.push(row);
          actionCount += rowActionCount;
        } else {
          await this.handleFailedRow(row);
        }
      }

      if (includedRows.length === 0) {
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

      (async () => {
        try {
          const recpt = await this.ethereumService.processBundle(
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
    this.tryAggregating();

    return submissionResult;
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

function toShortPublicKey(publicKey: PublicKey) {
  return ethers.utils.solidityPack(["uint256"], [publicKey[0]]).slice(2, 9);
}

function countActions(bundle: Bundle) {
  return bundle.operations.map((op) => op.actions.length).reduce(plus, 0);
}

function plus(a: number, b: number) {
  return a + b;
}
