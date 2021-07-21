import TxService from "../src/app/TxService.ts";
import { assertEquals, ethers } from "./deps.ts";
import Fixture from "./helpers/Fixture.ts";
import Range from "./helpers/Range.ts";

const txServiceConfig = {
  ...TxService.defaultConfig,

  // These may be the defaults, but they're technically env dependent, so we
  // make sure we have these values because the tests assume them.
  maxAggregationSize: 5,
  maxAggregationDelayMillis: 5000,
};

Fixture.test("submit a single transaction in a timed batch", async (fx) => {
  const txService = await fx.createTxService(txServiceConfig);
  const [{ blsSigner, blsWallet }] = await fx.setupWallets(1);

  const tx = await fx.createTxData({
    blsSigner,
    contract: fx.walletService.erc20,
    method: "mint",
    args: [blsWallet.address, "1"],
  });

  const failures = await txService.add(tx);
  assertEquals(failures, []);

  assertEquals(
    await fx.walletService.getBalanceOf(blsWallet.address),
    ethers.BigNumber.from(1000),
  );

  assertEquals(await fx.allTxs(txService), {
    ready: [{ ...tx, txId: 1 }],
    future: [],
  });

  fx.clock.advance(5000);
  await txService.batchTimer.waitForNextCompletion();

  assertEquals(
    await fx.walletService.getBalanceOf(blsWallet.address),
    ethers.BigNumber.from(1001),
  );

  assertEquals(await fx.allTxs(txService), {
    ready: [],
    future: [],
  });
});

Fixture.test("submit a full batch without delay", async (fx) => {
  const txService = await fx.createTxService();
  const [{ blsSigner, blsWallet }] = await fx.setupWallets(1);

  const firstBatchPromise = txService.batchTimer.waitForNextCompletion();

  const txs = await Promise.all(
    Range(5).map((i) =>
      fx.createTxData({
        blsSigner,
        contract: fx.walletService.erc20,
        method: "mint",
        args: [blsWallet.address, "1"],
        nonceOffset: i,
      })
    ),
  );

  const failures = await Promise.all(txs.map((tx) => txService.add(tx)));
  assertEquals(failures.flat(), []);

  await firstBatchPromise;

  // Check mints have occurred, ensuring a batch has occurred even though the
  // clock has not advanced
  assertEquals(
    await fx.walletService.getBalanceOf(blsWallet.address),
    ethers.BigNumber.from(1005), // 1000 (initial) + 5 * 1 (mint txs)
  );
});

// TODO: More tests

// TODO: Retest "concurrently" with batching
//       (derive concrete failure case from it)
