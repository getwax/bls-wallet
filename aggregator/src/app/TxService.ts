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

export default class TxService {
  static defaultConfig = {
    txQueryLimit: env.TX_QUERY_LIMIT,
    maxFutureTxs: env.MAX_FUTURE_TXS,
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    maxAggregationDelayMillis: env.MAX_AGGREGATION_DELAY_MILLIS,
    maxUnconfirmedAggregations: env.MAX_UNCONFIRMED_AGGREGATIONS,
  };

  unconfirmedTxs = new Set<TxTableRow>();
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

  async runSubmission() {
    this.submissionsInProgress++;

    const submissionResult = await this.runQueryGroup(async () => {
      const priorityTxs = await this.readyTxTable.getHighestPriority(
        this.config.txQueryLimit,
      );

      const submissionTxs: TxTableRow[] = priorityTxs.slice(
        0,
        this.config.maxAggregationSize,
      );

      if (submissionTxs.length > 0) {
        const maxUnconfirmedTxs = (
          this.config.maxUnconfirmedAggregations *
          this.config.maxAggregationSize
        );

        while (
          this.unconfirmedTxs.size + submissionTxs.length > maxUnconfirmedTxs
        ) {
          // FIXME (merge-ok): Polling
          this.emit({ type: "waiting-unconfirmed-space" });
          await delay(1000);
        }

        for (const tx of submissionTxs) {
          this.unconfirmedTxs.add(tx);
        }

        (async () => {
          try {
            const recpt = await this.ethereumService.sendTxs(
              submissionTxs,
              Infinity,
              300,
            );

            this.emit({
              type: "submission-confirmed",
              data: {
                txIds: submissionTxs.map((tx) => tx.txId),
                blockNumber: recpt.blockNumber,
              },
            });
          } finally {
            for (const tx of submissionTxs) {
              this.unconfirmedTxs.delete(tx);
            }
          }
        })();
      }

      await this.removeFromReady(submissionTxs);
    });

    this.submissionsInProgress--;
    this.tryAggregating();

    return submissionResult;
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

      // FIXME (merge-ok): Polling
      await delay(100);
    }
  }
}

function bigMax(a: BigNumber, b: BigNumber) {
  return a.gt(b) ? a : b;
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
