import {
  BigNumber,
  BlsWalletSigner,
  Bundle,
  ERC20,
  ERC20__factory,
  ethers,
} from "../../deps.ts";

import nil from "../helpers/nil.ts";
import Range from "../helpers/Range.ts";
import assert from "../helpers/assert.ts";
import bigSum from "./helpers/bigSum.ts";
import * as env from "../env.ts";
import EthereumService from "./EthereumService.ts";
import { BundleRow } from "./BundleTable.ts";
import countActions from "./helpers/countActions.ts";
import ClientReportableError from "./helpers/ClientReportableError.ts";

export default class AggregationStrategy {
  static defaultConfig = {
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    fees: {
      type: env.FEE_TYPE,
      perGas: env.FEE_PER_GAS,
      perByte: env.FEE_PER_BYTE,
    },
  };

  constructor(
    public blsWalletSigner: BlsWalletSigner,
    public ethereumService: EthereumService,
    public config = AggregationStrategy.defaultConfig,
  ) {}

  async run(eligibleRows: BundleRow[]): Promise<{
    aggregateBundle: Bundle | nil;
    includedRows: BundleRow[];
    failedRows: BundleRow[];
  }> {
    let aggregateBundle = this.blsWalletSigner.aggregate([]);
    const includedRows: BundleRow[] = [];
    const failedRows: BundleRow[] = [];

    while (eligibleRows.length > 0) {
      const {
        aggregateBundle: newAggregateBundle,
        includedRows: newIncludedRows,
        failedRows: newFailedRows,
        remainingEligibleRows,
      } = await this.#augmentAggregateBundle(
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

  async estimateFee(bundle: Bundle) {
    const es = this.ethereumService;
    const feeToken = this.#FeeToken();

    const balanceCall = feeToken
      ? es.Call(feeToken, "balanceOf", [es.wallet.address])
      : es.Call(es.utilities, "ethBalanceOf", [es.wallet.address]);

    const [
      balanceResultBefore,
      bundleResult,
      balanceResultAfter,
    ] = await es.callStaticSequence(
      balanceCall,
      es.Call(
        es.verificationGateway,
        "processBundle",
        [bundle],
      ),
      balanceCall,
    );

    if (
      balanceResultBefore.returnValue === undefined ||
      balanceResultAfter.returnValue === undefined
    ) {
      throw new ClientReportableError("Failed to get balance");
    }

    const balanceBefore = balanceResultBefore.returnValue[0];
    const balanceAfter = balanceResultAfter.returnValue[0];

    const feeDetected = balanceAfter.sub(balanceBefore);

    if (bundleResult.returnValue === undefined) {
      throw new ClientReportableError("Failed to statically process bundle");
    }

    const feeRequired = await this.#measureRequiredFee(bundle);

    const successes = bundleResult.returnValue.successes;

    return {
      feeDetected,
      feeRequired,
      successes,
    };
  }

  async #augmentAggregateBundle(
    previousAggregateBundle: Bundle,
    eligibleRows: BundleRow[],
  ): Promise<{
    aggregateBundle: Bundle;
    includedRows: BundleRow[];
    failedRows: BundleRow[];
    remainingEligibleRows: BundleRow[];
  }> {
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

    if (includedRows.length === 0) {
      return {
        aggregateBundle: previousAggregateBundle,
        includedRows,
        failedRows,

        // If we're not able to include anything more, don't consider any rows
        // eligible anymore.
        remainingEligibleRows: [],
      };
    }

    const [previousFee, ...fees] = (await this.#measureFees([
      previousAggregateBundle,
      ...includedRows.map((r) => r.bundle),
    ]));

    const firstFailureIndex = await this.#findFirstFailureIndex(
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

  async #measureFees(bundles: Bundle[]): Promise<{
    success: boolean;
    fee: BigNumber;
  }[]> {
    const es = this.ethereumService;
    const feeToken = this.#FeeToken();

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

  #FeeToken(): ERC20 | nil {
    const feeType = this.config.fees.type;

    if (feeType === "ether") {
      return nil;
    }

    return ERC20__factory.connect(
      feeType.slice("token:".length),
      this.ethereumService.wallet.provider,
    );
  }

  async #measureRequiredFee(bundle: Bundle) {
    const gasEstimate = await this.ethereumService.verificationGateway
      .estimateGas
      .processBundle(bundle);

    const gasPrice = await this.ethereumService.wallet.provider.getGasPrice();

    return gasEstimate.mul(gasPrice);
  }

  async #findFirstFailureIndex(
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

      const requiredFee = await this.#measureRequiredFee(
        this.blsWalletSigner.aggregate([
          previousAggregateBundle,
          ...bundles.slice(0, n),
        ]),
      );

      const success = fee.gte(requiredFee);

      return { success, fee, requiredFee };
    };

    let left = 0;
    let leftRequiredFee = BigNumber.from(0);
    let right: number;
    let rightRequiredFee: BigNumber;

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
}
