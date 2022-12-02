import {
  BigNumber,
  BlsWalletSigner,
  BlsWalletWrapper,
  Bundle,
  ERC20,
  ERC20__factory,
  Semaphore,
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

export default class AggregationStrategy {
  static defaultConfig = {
    maxAggregationSize: env.MAX_AGGREGATION_SIZE,
    fees: envFeeConfig,
  };

  #tokenDecimals?: number;

  // The concurrency of #checkBundlePaysRequiredFee is limited by this semaphore
  // because it can be called on many bundles in parallel
  #checkBundleSemaphore = new Semaphore(8);

  constructor(
    public blsWalletSigner: BlsWalletSigner,
    public ethereumService: EthereumService,
    public config = AggregationStrategy.defaultConfig,
    public emit: (event: AppEvent) => void = () => {},
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

    if (includedRows.length === 0) {
      return {
        aggregateBundle: nil,
        includedRows: [],
        failedRows: [],
      };
    }

    if (
      this.config.fees?.allowLosses === false &&
      !this.#checkBundlePaysRequiredFee(aggregateBundle, BigNumber.from(0))
    ) {
      this.emit({ type: "aggregate-bundle-unprofitable" });

      return {
        aggregateBundle: nil,
        includedRows: [],
        failedRows,
      };
    }

    return {
      aggregateBundle,
      includedRows,
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
    const candidateRows: BundleRow[] = []; // TODO: Rename?
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
      candidateRows.map((r) =>
        this.#checkBundlePaysRequiredFee(r.bundle, bundleOverheadGas)
      ),
    );

    return {
      aggregateBundle: this.blsWalletSigner.aggregate([
        previousAggregateBundle,
        ...candidateRows.map((r) => r.bundle),
      ]),
      includedRows: candidateRows.filter((_row, i) => rowChecks[i]),
      failedRows: candidateRows.filter((_row, i) => !rowChecks[i]),
      remainingEligibleRows: eligibleRows,
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

  async #checkBundlePaysRequiredFee(
    bundle: Bundle,
    bundleOverheadGas?: BigNumber,
  ) {
    return await this.#checkBundleSemaphore.use(async () => {
      const [
        requiredFee,
        [{ success, fee }],
      ] = await Promise.all([
        this.#measureRequiredFee(
          bundle,
          bundleOverheadGas,
        ),
        this.#measureFees([bundle]),
      ]);

      return success && fee.gte(requiredFee);
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
