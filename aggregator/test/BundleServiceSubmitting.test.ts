import { assertBundleSucceeds, assertEquals, BigNumber } from "./deps.ts";
import Fixture, { bundleServiceDefaultTestConfig } from "./helpers/Fixture.ts";
import Range from "../src/helpers/Range.ts";
import { AggregationStrategyConfig } from "../src/app/AggregationStrategy.ts";
import nil from "../src/helpers/nil.ts";

const bundleServiceConfig = {
  ...bundleServiceDefaultTestConfig,
  maxAggregationDelayMillis: 5000,
};

const aggregationStrategyConfig: AggregationStrategyConfig = {
  maxGasPerBundle: 900000,
  fees: nil,
  bundleCheckingConcurrency: 8,
};

Fixture.test("submits a single action in a timed submission", async (fx) => {
  const bundleService = fx.createBundleService(
    bundleServiceConfig,
    aggregationStrategyConfig,
  );

  const [wallet] = await fx.setupWallets(1);

  const bundle = wallet.sign({
    nonce: await wallet.Nonce(),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [wallet.address, 1],
        ),
      },
    ],
  });

  const bundleResponse = await bundleService.add(bundle);
  assertBundleSucceeds(bundleResponse);

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1000),
  );
  assertEquals(await bundleService.bundleTable.count(), 1);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1001),
  );
  assertEquals(await bundleService.bundleTable.count(), 1);

  if ("failures" in bundleResponse) {
    throw new Error("Bundle failed to be created");
  }
  const bundleRow = await bundleService.bundleTable.findBundle(
    bundleResponse.hash,
  );
  assertEquals(bundleRow?.status, "confirmed");

  const bundleReceipt = bundleService.receiptFromBundle(bundleRow!);
  assertEquals(bundleReceipt?.bundleHash, bundleResponse.hash);
});

Fixture.test("submits a full submission without delay", async (fx) => {
  const bundleService = fx.createBundleService(
    bundleServiceConfig,
    aggregationStrategyConfig,
  );

  const wallets = await fx.setupWallets(5);
  const firstWallet = wallets[0];
  const nonce = await firstWallet.Nonce();

  const bundles = wallets.map((wallet) =>
    wallet.sign({
      nonce,
      actions: [
        {
          ethValue: 0,
          contractAddress: fx.testErc20.address,
          encodedFunction: fx.testErc20.interface.encodeFunctionData(
            "mint",
            [firstWallet.address, 1],
          ),
        },
      ],
    })
  );

  for (const b of bundles) {
    assertBundleSucceeds(await bundleService.add(b));
  }

  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  // Check mints have occurred, ensuring a submission has occurred even though
  // the clock has not advanced
  assertEquals(
    await fx.testErc20.balanceOf(firstWallet.address),
    BigNumber.from(1005), // 1000 (initial) + 5 * 1 (mint txs)
  );
});

Fixture.test(
  "submits multiple aggregations when provided with too many user bundles",
  async (fx) => {
    const bundleService = fx.createBundleService(
      bundleServiceConfig,
      aggregationStrategyConfig,
    );

    const wallets = await fx.setupWallets(7);
    const firstWallet = wallets[0];
    const nonce = await firstWallet.Nonce();

    const bundles = wallets.map((wallet) =>
      wallet.sign({
        nonce,
        actions: [
          {
            ethValue: 0,
            contractAddress: fx.testErc20.address,
            encodedFunction: fx.testErc20.interface.encodeFunctionData(
              "mint",
              [firstWallet.address, 1],
            ),
          },
        ],
      })
    );

    // Prevent submission from triggering on max aggregation size.
    bundleService.config.breakevenOperationCount = Infinity;

    for (const b of bundles) {
      assertBundleSucceeds(await bundleService.add(b));
    }

    // Restore max aggregation size for testing. (This way we hit the edge case
    // that the aggregator has access to more actions than it can fit into a
    // single submission, which happens but is race-dependent.)
    bundleService.config.breakevenOperationCount = 4.5;

    await bundleService.submissionTimer.trigger();
    await bundleService.waitForConfirmations();

    if ((fx.allBundles(bundleService)).length > 0) {
      await bundleService.submissionTimer.trigger();
      await bundleService.waitForConfirmations();
    }

    // Check mints have occurred
    assertEquals(
      await fx.testErc20.balanceOf(firstWallet.address),
      BigNumber.from(1007), // 1000 (initial) + 7 * 1 (mint txs)
    );

    const confirmationEvents = fx.appEvents.filter((ev) =>
      ev.type === "submission-confirmed"
    );

    assertEquals(confirmationEvents.length, 2);
  },
);

Fixture.test(
  "submits 3 bundles in reverse (incorrect) nonce order",
  async (fx) => {
    const bundleService = fx.createBundleService(
      bundleServiceConfig,
      aggregationStrategyConfig,
    );

    const [wallet] = await fx.setupWallets(1);
    const walletNonce = await wallet.Nonce();

    const bundles = Range(3).reverse().map((i) =>
      wallet.sign({
        nonce: walletNonce.add(i),
        actions: [
          {
            ethValue: 0,
            contractAddress: fx.testErc20.address,
            encodedFunction: fx.testErc20.interface.encodeFunctionData(
              "mint",
              [wallet.address, 1],
            ),
          },
        ],
      })
    );

    for (const b of bundles) {
      assertBundleSucceeds(await bundleService.add(b));
    }

    await bundleService.submissionTimer.trigger();
    await bundleService.submissionTimer.waitForCompletedSubmissions(1);
    await bundleService.waitForConfirmations();

    // Check 3rd mint bundle occurred (nonce 1)
    assertEquals(
      await fx.testErc20.balanceOf(wallet.address),
      BigNumber.from(1001), // 1000 (initial) + 1 * 1 (mint txs)
    );
    assertEquals(await wallet.Nonce(), BigNumber.from(2));
    // 2 mints should be left as both failed submission pre-check
    let remainingBundles = fx.allBundles(bundleService);
    let remainingPendingBundles = remainingBundles.filter((bundle) =>
      bundle.status === "pending"
    );
    assertEquals(remainingPendingBundles.length, 2);

    // Re-run submissions
    await bundleService.submissionTimer.trigger();
    await bundleService.submissionTimer.waitForCompletedSubmissions(2);
    await bundleService.waitForConfirmations();

    // 2nd mint bundle (nonce 2) should now have gone through.
    assertEquals(
      await fx.testErc20.balanceOf(wallet.address),
      BigNumber.from(1002), // 1000 (initial) + 2 * 1 (mint txs)
    );
    assertEquals(await wallet.Nonce(), BigNumber.from(3));
    // 1 mints (nonce 3) should be left as it failed submission pre-check
    remainingBundles = fx.allBundles(bundleService);
    remainingPendingBundles = remainingBundles.filter((bundle) =>
      bundle.status === "pending"
    );
    assertEquals(remainingPendingBundles.length, 1);

    // Simulate 1 block being mined
    await fx.mine(1);

    // Re-run submissions
    await bundleService.submissionTimer.trigger();
    await bundleService.submissionTimer.waitForCompletedSubmissions(3);
    await bundleService.waitForConfirmations();

    // 3rd mint bundle (nonce 3) should now have gone through.
    assertEquals(
      await fx.testErc20.balanceOf(wallet.address),
      BigNumber.from(1003), // 1000 (initial) + 3 * 1 (mint txs)
    );
    assertEquals(await wallet.Nonce(), BigNumber.from(4));
    remainingBundles = fx.allBundles(bundleService);
    remainingPendingBundles = remainingBundles.filter((bundle) =>
      bundle.status === "pending"
    );
    assertEquals(remainingPendingBundles.length, 0);
  },
);

Fixture.test("retains failing bundle when its eligibility delay is smaller than MAX_ELIGIBILITY_DELAY", async (fx) => {
  const bundleService = fx.createBundleService(
    {
      ...bundleServiceConfig,
      maxEligibilityDelay: 300,
    },
    aggregationStrategyConfig,
  );

  const [wallet] = await fx.setupWallets(1);

  const bundle = wallet.sign({
    // Future nonce makes this a failing bundle
    nonce: (await wallet.Nonce()).add(1),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [wallet.address, 1],
        ),
      },
    ],
  });

  // "failing" above refers to execution, which doesn't cause failure to simply
  // add it to the service
  const res = await bundleService.add(bundle);
  await bundleService.runPendingTasks();
  assertBundleSucceeds(res);

  assertEquals(await bundleService.bundleTable.count(), 1);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);

  assertEquals(await bundleService.bundleTable.count(), 1);
});

Fixture.test("updates status of failing bundle when its eligibility delay is larger than MAX_ELIGIBILITY_DELAY", async (fx) => {
  const bundleService = fx.createBundleService(
    {
      ...bundleServiceConfig,
      maxEligibilityDelay: 300,
    },
    aggregationStrategyConfig,
  );

  const [wallet] = await fx.setupWallets(1);

  const bundle = wallet.sign({
    // Future nonce makes this a failing bundle
    nonce: (await wallet.Nonce()).add(1),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [wallet.address, 1],
        ),
      },
    ],
  });

  // "failing" above refers to execution, which doesn't cause failure to simply
  // add it to the service
  const res = await bundleService.add(bundle);
  await bundleService.runPendingTasks();
  assertBundleSucceeds(res);

  assertEquals(await bundleService.bundleTable.count(), 1);

  const [bundleRow] = await bundleService.bundleTable.all();

  await bundleService.bundleTable.update({
    ...bundleRow,
    nextEligibilityDelay: BigNumber.from(1000),
  });

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);

  assertEquals(await bundleService.bundleTable.count(), 1);

  if ("failures" in res) {
    throw new Error("Bundle failed to be created");
  }
  const failedBundleRow = await bundleService.bundleTable.findBundle(res.hash);
  assertEquals(failedBundleRow?.status, "failed");
});
