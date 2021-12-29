import BundleService from "../src/app/BundleService.ts";
import { assertEquals, BigNumber } from "./deps.ts";
import Fixture from "./helpers/Fixture.ts";
import Range from "../src/helpers/Range.ts";

const bundleServiceConfig = {
  ...BundleService.defaultConfig,

  // These may be the defaults, but they're technically env dependent, so we
  // make sure we have these values because the tests assume them.
  maxAggregationSize: 5,
  maxAggregationDelayMillis: 5000,
};

Fixture.test("submits a single action in a timed submission", async (fx) => {
  const bundleService = await fx.createBundleService(bundleServiceConfig);
  const [wallet] = await fx.setupWallets(1);

  const bundle = wallet.sign({
    nonce: await wallet.Nonce(),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.contract.address,
        encodedFunction: fx.testErc20.contract.interface.encodeFunctionData(
          "mint",
          [wallet.address, 1],
        ),
      },
    ],
  });

  const failures = await bundleService.add(bundle);
  assertEquals(failures, []);

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1000),
  );
  assertEquals(await bundleService.bundleTable.count(), 1n);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1001),
  );
  assertEquals(await bundleService.bundleTable.count(), 0n);
});

Fixture.test("submits a full submission without delay", async (fx) => {
  const bundleService = await fx.createBundleService(bundleServiceConfig);
  const [wallet] = await fx.setupWallets(1);
  const walletNonce = await wallet.Nonce();

  const bundles = Range(5).map((i) =>
    wallet.sign({
      nonce: walletNonce.add(i),
      actions: [
        {
          ethValue: 0,
          contractAddress: fx.testErc20.contract.address,
          encodedFunction: fx.testErc20.contract.interface.encodeFunctionData(
            "mint",
            [wallet.address, 1],
          ),
        },
      ],
    })
  );

  const failures = [];
  for (const b of bundles) {
    failures.push(await bundleService.add(b));
  }
  assertEquals(failures.flat(), []);

  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  // Check mints have occurred, ensuring a submission has occurred even though
  // the clock has not advanced
  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1005), // 1000 (initial) + 5 * 1 (mint txs)
  );
});

Fixture.test(
  [
    "submits submission from over-full bundle table without delay and submits",
    "leftover bundles after delay",
  ].join(" "),
  async (fx) => {
    const bundleService = await fx.createBundleService(bundleServiceConfig);
    const [wallet] = await fx.setupWallets(1);
    const walletNonce = await wallet.Nonce();

    const bundles = Range(7).map((i) =>
      wallet.sign({
        nonce: walletNonce.add(i),
        actions: [
          {
            ethValue: 0,
            contractAddress: fx.testErc20.contract.address,
            encodedFunction: fx.testErc20.contract.interface.encodeFunctionData(
              "mint",
              [wallet.address, 1],
            ),
          },
        ],
      })
    );

    const failures = [];
    for (const b of bundles) {
      failures.push(await bundleService.add(b));
    }
    assertEquals(failures.flat(), []);

    await bundleService.submissionTimer.waitForCompletedSubmissions(1);
    await bundleService.waitForConfirmations();

    // Check mints have occurred, ensuring a submission has occurred even though the
    // clock has not advanced
    assertEquals(
      await fx.testErc20.balanceOf(wallet.address),
      BigNumber.from(1005), // 1000 (initial) + 5 * 1 (mint txs)
    );

    // Leftover txs
    const remainingBundles = await fx.allBundles(bundleService);
    assertEquals(remainingBundles.length, 2);

    await fx.clock.advance(5000);
    await bundleService.submissionTimer.waitForCompletedSubmissions(2);
    await bundleService.waitForConfirmations();

    assertEquals(
      await fx.testErc20.balanceOf(wallet.address),
      BigNumber.from(1007), // 1000 (initial) + 7 * 1 (mint txs)
    );
  },
);

Fixture.test(
  "submits 3 bundles in reverse (incorrect) nonce order",
  async (fx) => {
    const bundleService = await fx.createBundleService(bundleServiceConfig);
    const [wallet] = await fx.setupWallets(1);
    const walletNonce = await wallet.Nonce();

    const bundles = Range(3).reverse().map((i) =>
      wallet.sign({
        nonce: walletNonce.add(i),
        actions: [
          {
            ethValue: 0,
            contractAddress: fx.testErc20.contract.address,
            encodedFunction: fx.testErc20.contract.interface.encodeFunctionData(
              "mint",
              [wallet.address, 1],
            ),
          },
        ],
      })
    );

    const failures = [];
    for (const b of bundles) {
      failures.push(await bundleService.add(b));
    }
    assertEquals(failures.flat(), []);

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
    let remainingBundles = await fx.allBundles(bundleService);
    assertEquals(remainingBundles.length, 2);

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
    remainingBundles = await fx.allBundles(bundleService);
    assertEquals(remainingBundles.length, 1);

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
    remainingBundles = await fx.allBundles(bundleService);
    assertEquals(remainingBundles.length, 0);
  },
);

Fixture.test("retains failing bundle when its eligibility delay is smaller than MAX_ELIGIBILITY_DELAY", async (fx) => {
  const bundleService = await fx.createBundleService({
    ...bundleServiceConfig,
    maxEligibilityDelay: 300,
  });

  const [wallet] = await fx.setupWallets(1);

  const bundle = wallet.sign({
    // Future nonce makes this a failing bundle
    nonce: (await wallet.Nonce()).add(1),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.contract.address,
        encodedFunction: fx.testErc20.contract.interface.encodeFunctionData(
          "mint",
          [wallet.address, 1],
        ),
      },
    ],
  });

  // "failing" above refers to execution, which doesn't cause failure to simply
  // add it to the service
  const failures = await bundleService.add(bundle);
  await bundleService.runPendingTasks();
  assertEquals(failures, []);

  assertEquals(await bundleService.bundleTable.count(), 1n);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);

  assertEquals(await bundleService.bundleTable.count(), 1n);
});

Fixture.test("removes failing bundle when its eligibility delay is larger than MAX_ELIGIBILITY_DELAY", async (fx) => {
  const bundleService = await fx.createBundleService({
    ...bundleServiceConfig,
    maxEligibilityDelay: 300,
  });

  const [wallet] = await fx.setupWallets(1);

  const bundle = wallet.sign({
    // Future nonce makes this a failing bundle
    nonce: (await wallet.Nonce()).add(1),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.contract.address,
        encodedFunction: fx.testErc20.contract.interface.encodeFunctionData(
          "mint",
          [wallet.address, 1],
        ),
      },
    ],
  });

  // "failing" above refers to execution, which doesn't cause failure to simply
  // add it to the service
  const failures = await bundleService.add(bundle);
  await bundleService.runPendingTasks();
  assertEquals(failures, []);

  assertEquals(await bundleService.bundleTable.count(), 1n);

  const [bundleRow] = await bundleService.bundleTable.all();

  await bundleService.bundleTable.update({
    ...bundleRow,
    nextEligibilityDelay: BigNumber.from(1000),
  });

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);

  assertEquals(await bundleService.bundleTable.count(), 0n);
});
