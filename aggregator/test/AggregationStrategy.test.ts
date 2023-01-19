import AggregationStrategy from "../src/app/AggregationStrategy.ts";
import { BundleRow } from "../src/app/BundleTable.ts";
import assert from "../src/helpers/assert.ts";
import nil from "../src/helpers/nil.ts";
import { assertEquals, BigNumber, ethers } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("nonzero fee estimate from default test config", async (fx) => {
  const [wallet] = await fx.setupWallets(1);

  const bundle = wallet.sign({
    nonce: await wallet.Nonce(),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [wallet.address, 3],
        ),
      },
    ],
  });

  const feeEstimation = await fx.aggregationStrategy.estimateFee(bundle);

  assertEquals(feeEstimation.feeDetected, BigNumber.from(0));
  assert(feeEstimation.feeRequired.gt(0));
  assertEquals(feeEstimation.successes, [true]);
});

Fixture.test("includes bundle in aggregation when estimated fee is provided", async (fx) => {
  const [wallet] = await fx.setupWallets(1);

  const aggregationStrategy = new AggregationStrategy(
    fx.blsWalletSigner,
    fx.ethereumService,
    {
      maxGasPerBundle: 1500000,
      fees: {
        type: "token",
        address: fx.testErc20.address,
        allowLosses: true,
        breakevenOperationCount: 4.5,
        ethValueInTokens: 1300,
      },
      bundleCheckingConcurrency: 8,
    },
  );

  const nonce = await wallet.Nonce();

  let bundle = wallet.sign({
    nonce,
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [
            fx.ethereumService.wallet.address,
            // Before we know the real fee, we provide 1 wei when calling
            // estimateFee so that the fee transfer itself can be included in
            // the estimate.
            1,
          ],
        ),
      },
    ],
  });

  const feeEstimation = await aggregationStrategy.estimateFee(bundle);

  const safetyDivisor = 5;
  const safetyPremium = feeEstimation.feeRequired.div(safetyDivisor);

  // Due to small fluctuations is gas estimation, we add a little safety premium
  // to the fee to increase the chance that it actually gets accepted during
  // aggregation.
  const safeFee = feeEstimation.feeRequired.add(safetyPremium);

  assertEquals(feeEstimation.feeDetected, BigNumber.from(1));

  // Redefine bundle using the estimated fee
  bundle = wallet.sign({
    nonce,
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [fx.ethereumService.wallet.address, safeFee],
        ),
      },
    ],
  });

  const bundleRow: BundleRow = {
    id: 0,
    status: "pending",
    hash: "0x0",
    bundle,
    eligibleAfter: BigNumber.from(0),
    nextEligibilityDelay: BigNumber.from(1),
  };

  const aggregationResult = await aggregationStrategy.run([bundleRow]);

  assertEquals(aggregationResult.aggregateBundle, bundle);
  assertEquals(aggregationResult.includedRows, [bundleRow]);
  assertEquals(aggregationResult.failedRows, []);
});

Fixture.test("includes submitError on failed row when bundle callStaticSequence fails", async (fx) => {
  const [wallet] = await fx.setupWallets(1);

  const aggregationStrategy = new AggregationStrategy(
    fx.blsWalletSigner,
    fx.ethereumService,
    {
      maxGasPerBundle: 1500000,
      fees: {
        type: "token",
        address: fx.testErc20.address,
        allowLosses: true,
        breakevenOperationCount: 4.5,
        ethValueInTokens: 1300,
      },
      bundleCheckingConcurrency: 8,
    },
  );

  const nonce = await wallet.Nonce();

  const bundle = wallet.sign({
    nonce,
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "transferFrom",
          [
            "0x0000000000000000000000000000000000000000",
            wallet.address,
            ethers.BigNumber.from(
              "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            ),
          ],
        ),
      },
    ],
  });

  const bundleRow: BundleRow = {
    id: 0,
    status: "pending",
    hash: "0x0",
    bundle,
    eligibleAfter: BigNumber.from(0),
    nextEligibilityDelay: BigNumber.from(1),
  };

  const aggregationResult = await aggregationStrategy.run([bundleRow]);

  const expectedFailedRow = {
    ...bundleRow,
    submitError: "ERC20: insufficient allowance",
  };

  assertEquals(aggregationResult.aggregateBundle, nil);
  assertEquals(aggregationResult.includedRows, []);
  assertEquals(aggregationResult.failedRows, [expectedFailedRow]);
});
