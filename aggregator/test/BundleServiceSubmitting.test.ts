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

  const failures = await Promise.all(
    bundles.map((bundle) => bundleService.add(bundle)),
  );

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

    const failures = await Promise.all(
      bundles.map((bundle) => bundleService.add(bundle)),
    );

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
    assertEquals(await fx.allTxs(bundleService), {
      ready: [txs[5], txs[6]],
      future: [],
    });

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
  "submits 3 bundles added concurrently in a jumbled order",
  async (fx) => {
    const bundleService = await fx.createBundleService({
      ...bundleServiceConfig,

      // TODO (merge-ok): Stop overriding this when BlsWallet nonces become
      // explicit. Without this, submissions will be sent concurrently, and the
      // submissions that are dependent on the first one will get rejected on
      // the sig check.
      maxUnconfirmedAggregations: 1,
    });

    const [wallet] = await fx.setupWallets(1);
    const walletNonce = await wallet.Nonce();

    const txs = fx.rng.shuffle(Range(3)).map((i) =>
      wallet.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [wallet.address, "1"],
        nonce: walletNonce.add(i),
      })
    );

    const failures = await Promise.all(txs.map((tx) => bundleService.add(tx)));
    assertEquals(failures.flat(), []);

    await bundleService.submissionTimer.waitForCompletedSubmissions(3);
    await bundleService.waitForConfirmations();

    // Check mints have occurred
    assertEquals(
      await fx.testErc20.balanceOf(wallet.address),
      BigNumber.from(1015), // 1000 (initial) + 15 * 1 (mint txs)
    );

    // Nothing left over
    assertEquals(await fx.allTxs(bundleService), {
      ready: [],
      future: [],
    });
  },
);
