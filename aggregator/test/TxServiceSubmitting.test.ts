import TxService from "../src/app/TxService.ts";
import { assertEquals, BigNumber } from "./deps.ts";
import Fixture from "./helpers/Fixture.ts";
import Range from "../src/helpers/Range.ts";

const txServiceConfig = {
  ...TxService.defaultConfig,

  // These may be the defaults, but they're technically env dependent, so we
  // make sure we have these values because the tests assume them.
  maxAggregationSize: 5,
  maxAggregationDelayMillis: 5000,
};

Fixture.test("submits a single transaction in a timed submission", async (fx) => {
  const txService = await fx.createTxService(txServiceConfig);
  const [wallet] = await fx.setupWallets(1);

  const tx = wallet.sign({
    contract: fx.testErc20.contract,
    method: "mint",
    args: [wallet.address, "1"],
    nonce: await wallet.Nonce(),
  });

  const failures = await txService.add(tx);
  assertEquals(failures, []);

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1000),
  );

  assertEquals(await fx.allTxs(txService), {
    ready: [tx],
    future: [],
  });

  fx.clock.advance(5000);
  await txService.submissionTimer.waitForCompletedSubmissions(1);
  await txService.waitForConfirmations();

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1001),
  );

  assertEquals(await fx.allTxs(txService), {
    ready: [],
    future: [],
  });
});

Fixture.test("submits a full submission without delay", async (fx) => {
  const txService = await fx.createTxService(txServiceConfig);
  const [wallet] = await fx.setupWallets(1);
  const walletNonce = await wallet.Nonce();

  const txs = Range(5).map((i) =>
    wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "1"],
      nonce: walletNonce.add(i),
    })
  );

  const failures = await Promise.all(txs.map((tx) => txService.add(tx)));
  assertEquals(failures.flat(), []);

  await txService.submissionTimer.waitForCompletedSubmissions(1);
  await txService.waitForConfirmations();

  // Check mints have occurred, ensuring a submission has occurred even though
  // the clock has not advanced
  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1005), // 1000 (initial) + 5 * 1 (mint txs)
  );
});

Fixture.test(
  [
    "submits submission from over-full readyTxs without delay and submits leftover",
    "txs after delay",
  ].join(" "),
  async (fx) => {
    const txService = await fx.createTxService(txServiceConfig);
    const [wallet] = await fx.setupWallets(1);
    const walletNonce = await wallet.Nonce();

    const txs = Range(7).map((i) =>
      wallet.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [wallet.address, "1"],
        nonce: walletNonce.add(i),
      })
    );

    const failures = await Promise.all(txs.map((tx) => txService.add(tx)));
    assertEquals(failures.flat(), []);

    await txService.submissionTimer.waitForCompletedSubmissions(1);
    await txService.waitForConfirmations();

    // Check mints have occurred, ensuring a submission has occurred even though the
    // clock has not advanced
    assertEquals(
      await fx.testErc20.balanceOf(wallet.address),
      BigNumber.from(1005), // 1000 (initial) + 5 * 1 (mint txs)
    );

    // Leftover txs
    assertEquals(await fx.allTxs(txService), {
      ready: [txs[5], txs[6]],
      future: [],
    });

    await fx.clock.advance(5000);
    await txService.submissionTimer.waitForCompletedSubmissions(2);
    await txService.waitForConfirmations();

    assertEquals(
      await fx.testErc20.balanceOf(wallet.address),
      BigNumber.from(1007), // 1000 (initial) + 7 * 1 (mint txs)
    );
  },
);

Fixture.test(
  "submits 3 submissions added concurrently in a jumbled order",
  async (fx) => {
    const txService = await fx.createTxService({
      ...txServiceConfig,

      // TODO (merge-ok): Stop overriding this when BlsWallet nonces become
      // explicit. Without this, submissions will be sent concurrently, and the
      // submissions that are dependent on the first one will get rejected on
      // the sig check.
      maxUnconfirmedAggregations: 1,
    });

    const [wallet] = await fx.setupWallets(1);
    const walletNonce = await wallet.Nonce();

    const txs = fx.rng.shuffle(Range(15)).map((i) =>
      wallet.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [wallet.address, "1"],
        nonce: walletNonce.add(i),
      })
    );

    const failures = await Promise.all(txs.map((tx) => txService.add(tx)));
    assertEquals(failures.flat(), []);

    await txService.submissionTimer.waitForCompletedSubmissions(3);
    await txService.waitForConfirmations();

    // Check mints have occurred
    assertEquals(
      await fx.testErc20.balanceOf(wallet.address),
      BigNumber.from(1015), // 1000 (initial) + 15 * 1 (mint txs)
    );

    // Nothing left over
    assertEquals(await fx.allTxs(txService), {
      ready: [],
      future: [],
    });
  },
);