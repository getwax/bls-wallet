import {
  BigNumber,
  BlsWalletSigner,
  BlsWalletWrapper,
  Bundle,
  decodeError,
  ERC20,
  ERC20__factory,
  OperationResultError,
  Semaphore,
  shuffled,
} from "../../deps.ts";

import nil from "../helpers/nil.ts";
import Range from "../helpers/Range.ts";
import assert from "../helpers/assert.ts";
import * as env from "../env.ts";
import EthereumService from "./EthereumService.ts";
import { BundleRow } from "./BundleTable.ts";
import countActions from "./helpers/countActions.ts";
import ClientReportableError from "./helpers/ClientReportableError.ts";
import AppEvent from "./AppEvent.ts";

type FeeConfig =
  | {
    type: "ether";
    allowLosses: boolean;
    breakevenOperationCount: number;
  }
  | {
    type: "token";
    address: string;
    ethValueInTokens: number;
    allowLosses: boolean;
    breakevenOperationCount: number;
  }
  | nil;

const envFeeConfig = ((): FeeConfig => {
  if (!env.REQUIRE_FEES) {
    return nil;
  }

  if (env.FEE_TYPE === "ether") {
    return {
      type: "ether",
      allowLosses: env.ALLOW_LOSSES,
      breakevenOperationCount: env.BREAKEVEN_OPERATION_COUNT,
    };
  }

  const feeTypeParts = env.FEE_TYPE.split(":");
  assert(feeTypeParts.length === 2);
  assert(feeTypeParts[0] === "token");

  const address = feeTypeParts[1];
  assert(/^0x[0-9a-fA-F]*$/.test(address));

  assert(env.ETH_VALUE_IN_TOKENS !== nil);

  return {
    type: "token",
    address,
    ethValueInTokens: env.ETH_VALUE_IN_TOKENS,
    allowLosses: env.ALLOW_LOSSES,
    breakevenOperationCount: env.BREAKEVEN_OPERATION_COUNT,
  };
})();

export type AggregationStrategyResult = {
  aggregateBundle: Bundle | nil;
  includedRows: BundleRow[];
  failedRows: BundleRow[];
};

export default class AggregationStrategy {
  static defaultConfig = {
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    fees: envFeeConfig,
  };

  #tokenDecimals?: number;

  // The concurrency of #checkBundle is limited by this semaphore because it can
  // be called on many bundles in parallel
  #checkBundleSemaphore = new Semaphore(8);

  constructor(
    public blsWalletSigner: BlsWalletSigner,
    public ethereumService: EthereumService,
    public config = AggregationStrategy.defaultConfig,
    public emit: (event: AppEvent) => void = () => {},
  ) {}

  async run(eligibleRows: BundleRow[]): Promise<AggregationStrategyResult> {
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

    if (includedRows.length === 0) {
      return {
        aggregateBundle: nil,
        includedRows: [],
        failedRows: [],
      };
    }

    let result: AggregationStrategyResult = {
      aggregateBundle,
      includedRows,
      failedRows,
    };

    if (this.config.fees?.allowLosses === false) {
      result = await this.#preventLosses(
        result,
        this.config.fees.breakevenOperationCount,
      );
    }

    return result;
  }

  /**
   * This is not guaranteed to prevent losses. We cannot 100% know what is going
   * to happen until the bundle is actually submitted on chain.
   */
  async #preventLosses(
    result: AggregationStrategyResult,
    breakevenOperationCount: number,
  ): Promise<AggregationStrategyResult> {
    if (result.aggregateBundle === nil) {
      return result;
    }

    const { aggregateBundle, includedRows, failedRows } = result;

    const { success, errorReason } = await this.#checkBundle(
      aggregateBundle,
      BigNumber.from(0),
    );

    if (success) {
      return result;
    }

    this.emit({
      type: "aggregate-bundle-unprofitable",
      reason: errorReason?.message,
    });

    if (aggregateBundle.operations.length < breakevenOperationCount) {
      return result;
    }

    this.emit({ type: "unprofitable-despite-breakeven-operations" });

    // This is unexpected: We have enough operations to breakeven, but the
    // bundle is unprofitable instead.
    //
    // This could happen due to small variations on a bundle that is
    // borderline, but it could also happen due to an intentional attack.
    // In the simplest case, an attacker submits two bundles that both pay
    // when simulated in isolation, but the first sets state that prevents
    // payment on the second bundle. We need to do something about this
    // because it could otherwise put us into a state that might never
    // resolve - next time we form a bundle, we'll run into the same issue
    // because the bundles will be considered again in the same order.
    //
    // To fix this, we simply mark half the bundles as failed. We could
    // isolate the issue by doing a lot of in-order reprocessing, but
    // having this defense in place should prevent the attack in the first
    // place, so false-positives here are a minor concern (keeping in mind
    // these bundles will still get retried later).

    let failureSample = shuffled(includedRows);
    failureSample = failureSample.slice(0, failureSample.length / 2);

    for (const row of failureSample) {
      row.submitError = "Included in failure sample for unprofitable bundle";
    }

    failedRows.push(...failureSample);

    return {
      aggregateBundle: nil,
      includedRows: [],
      failedRows,
    };
  }

  async estimateFee(bundle: Bundle, bundleOverheadGas?: BigNumber) {
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

    const feeRequired = await this.#measureRequiredFee(
      bundle,
      bundleOverheadGas,
    );

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
    const candidateRows: BundleRow[] = [];
    // TODO (merge-ok): Count gas instead, have idea
    // or way to query max gas per txn (submission).
    let actionCount = countActions(previousAggregateBundle);

    while (true) {
      const row = eligibleRows[0];

      if (!row) {
        break;
      }

      const rowActionCount = countActions(row.bundle);

      if (actionCount + rowActionCount > this.config.maxAggregationSize) {
        break;
      }

      eligibleRows.shift();
      candidateRows.push(row);
      actionCount += rowActionCount;
    }

    if (candidateRows.length === 0) {
      return {
        aggregateBundle: previousAggregateBundle,
        includedRows: [],
        failedRows: [],

        // If we're not able to include anything more, don't consider any rows
        // eligible anymore.
        remainingEligibleRows: [],
      };
    }

    const bundleOverheadGas = await this.#measureBundleOverheadGas();

    // Checking in parallel here. Concurrency is limited by a semaphore used in
    // #checkBundlePaysRequiredFee.
    const rowChecks = await Promise.all(
      candidateRows.map((r) => this.#checkBundle(r.bundle, bundleOverheadGas)),
    );

    const includedRows: BundleRow[] = [];
    const failedRows: BundleRow[] = [];

    for (const [i, { success, errorReason }] of rowChecks.entries()) {
      const row = candidateRows[i];

      if (success) {
        includedRows.push(row);
      } else {
        if (errorReason) {
          row.submitError = errorReason.message;
        }

        failedRows.push(row);
      }
    }

    return {
      aggregateBundle: this.blsWalletSigner.aggregate([
        previousAggregateBundle,
        ...includedRows.map((r) => r.bundle),
      ]),
      includedRows,
      failedRows,
      remainingEligibleRows: eligibleRows,
    };
  }

  async #measureFees(bundles: Bundle[]): Promise<{
    success: boolean;
    fee: BigNumber;
    errorReason: OperationResultError | nil;
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
      const fee = after.returnValue[0].sub(before.returnValue[0]);
      if (!bundleResult.success) {
        const errorReason: OperationResultError = {
          message: "Unknown error reason",
        };
        return { success: false, fee, errorReason };
      }

      const [operationStatuses, results] = bundleResult.returnValue;

      let errorReason: OperationResultError | nil;
      // We require that at least one operation succeeds, even though
      // processBundle doesn't revert in this case.
      const success = operationStatuses.some((opSuccess: boolean) =>
        opSuccess === true
      );

      // If operation is not successful, attempt to decode an error message
      if (!success) {
        const error = results.map((result: string[]) => {
          try {
            if (result[0]) {
              return decodeError(result[0]);
            }
            return;
          } catch (err) {
            console.error(err);
            return;
          }
        });
        errorReason = error[0];
      }

      return { success, fee, errorReason };
    });
  }

  #FeeToken(): ERC20 | nil {
    if (this.config.fees?.type !== "token") {
      return nil;
    }

    return ERC20__factory.connect(
      this.config.fees.address,
      this.ethereumService.wallet.provider,
    );
  }

  async #measureRequiredFee(bundle: Bundle, bundleOverheadGas?: BigNumber) {
    if (this.config.fees === nil) {
      return BigNumber.from(0);
    }

    bundleOverheadGas ??= await this.#measureBundleOverheadGas();

    const gasEstimate = await this.ethereumService.verificationGateway
      .estimateGas
      .processBundle(bundle);

    const marginalGasEstimate = gasEstimate.sub(bundleOverheadGas);

    const bundleOverheadGasContribution = BigNumber.from(
      Math.ceil(
        bundleOverheadGas.toNumber() /
          this.config.fees.breakevenOperationCount * bundle.operations.length,
      ),
    );

    const requiredGas = marginalGasEstimate.add(bundleOverheadGasContribution);

    const gasPrice = await this.ethereumService.wallet.provider.getGasPrice();

    const ethWeiFee = requiredGas.mul(gasPrice);

    const token = this.#FeeToken();

    if (!token) {
      return ethWeiFee;
    }

    const decimals = await this.#TokenDecimals();
    const decimalAdj = 10 ** (decimals - 18);

    assert(this.config.fees?.type === "token");
    const ethWeiOverTokenWei = decimalAdj * this.config.fees.ethValueInTokens;

    return BigNumber.from(Math.ceil(ethWeiFee.toNumber() * ethWeiOverTokenWei));
  }

  async #checkBundle(
    bundle: Bundle,
    bundleOverheadGas?: BigNumber,
  ): Promise<{ success: boolean; errorReason?: OperationResultError }> {
    return await this.#checkBundleSemaphore.use(async () => {
      const [
        requiredFee,
        [{ success, fee, errorReason }],
      ] = await Promise.all([
        this.#measureRequiredFee(
          bundle,
          bundleOverheadGas,
        ),
        this.#measureFees([bundle]),
      ]);

      if (success && fee.lt(requiredFee)) {
        return {
          success: false,
          errorReason: { message: "Insufficient fee" },
        };
      }

      return { success, errorReason };
    });
  }

  async #measureBundleOverheadGas() {
    // The simple way to do this would be to estimate the gas of an empty
    // bundle. However, an empty bundle is a bit of a special case, in
    // particular the on-chain BLS library outright refuses to validate it. So
    // instead we estimate one operation and two operations and extrapolate
    // backwards to zero operations.

    const blsWallet = await BlsWalletWrapper.connect(
      env.PRIVATE_KEY_AGG,
      this.ethereumService.verificationGateway.address,
      this.ethereumService.wallet.provider,
    );

    const nonce = await blsWallet.Nonce();

    const bundle1 = blsWallet.sign({
      nonce,
      actions: [],
    });

    const bundle2 = blsWallet.sign({
      nonce: nonce.add(1),
      actions: [],
    });

    const [oneOpGasEstimate, twoOpGasEstimate] = await Promise.all([
      this.ethereumService.verificationGateway.estimateGas.processBundle(
        bundle1,
      ),
      this.ethereumService.verificationGateway.estimateGas.processBundle(
        this.blsWalletSigner.aggregate([bundle1, bundle2]),
      ),
    ]);

    const opMarginalGasEstimate = twoOpGasEstimate.sub(oneOpGasEstimate);

    return oneOpGasEstimate.sub(opMarginalGasEstimate);
  }

  async #TokenDecimals(): Promise<number> {
    if (this.#tokenDecimals === nil) {
      const token = this.#FeeToken();
      assert(token !== nil);
      this.#tokenDecimals = await token.decimals();
    }

    return this.#tokenDecimals;
  }
}
