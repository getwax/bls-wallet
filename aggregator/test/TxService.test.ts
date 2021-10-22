import TxService from "../src/app/TxService.ts";
import { assertEquals } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";
import Range from "../src/helpers/Range.ts";

Fixture.test("adds valid transaction", async (fx) => {
  const txService = await fx.createTxService();
  const [wallet] = await fx.setupWallets(1);

  const tx = wallet.sign({
    contract: fx.testErc20.contract,
    method: "mint",
    args: [wallet.address, "3"],
    nonce: await wallet.Nonce(),
  });

  assertEquals(await txService.readyTxTable.count(), 0n);

  const failures = await txService.add(tx);
  assertEquals(failures, []);

  assertEquals(await txService.readyTxTable.count(), 1n);
});

Fixture.test("rejects transaction with invalid signature", async (fx) => {
  const txService = await fx.createTxService();
  const [wallet, otherWallet] = await fx.setupWallets(2);

  const signParams = {
    contract: fx.testErc20.contract,
    method: "mint",
    args: [wallet.address, "3"],
    nonce: await wallet.Nonce(),
  };

  const tx = wallet.sign(signParams);
  const otherTx = otherWallet.sign(signParams);

  // Make the signature invalid
  // Note: Bug in bls prevents just corrupting the signature (see other invalid
  // sig test)
  tx.signature = otherTx.signature;

  assertEquals(await txService.readyTxTable.count(), 0n);

  const failures = await txService.add(tx);
  assertEquals(failures.map((f) => f.type), ["invalid-signature"]);

  // Transaction table remains empty
  assertEquals(await txService.readyTxTable.count(), 0n);
});

Fixture.test("rejects transaction with nonce from the past", async (fx) => {
  const txService = await fx.createTxService();
  const [wallet] = await fx.setupWallets(1);

  const tx = wallet.sign({
    contract: fx.testErc20.contract,
    method: "mint",
    args: [wallet.address, "3"],
    nonce: (await wallet.Nonce()).sub(1),
  });

  assertEquals(await txService.readyTxTable.count(), 0n);

  const failures = await txService.add(tx);
  assertEquals(failures.map((f) => f.type), ["duplicate-nonce"]);

  // Transaction table remains empty
  assertEquals(await txService.readyTxTable.count(), 0n);
});

Fixture.test(
  "rejects transaction with invalid signature and nonce from the past",
  async (fx) => {
    const txService = await fx.createTxService();
    const [wallet, otherWallet] = await fx.setupWallets(2);

    const signParams = {
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "3"],
      nonce: (await wallet.Nonce()).sub(1),
    };

    const tx = wallet.sign(signParams);
    const otherTx = otherWallet.sign(signParams);

    // Use signature from otherTx to make it invalid
    // Note: It would be faster to corrupt the existing signature than set up
    // another wallet, but there is a bug in hubbleBls that throws instead of
    // returning false when you do that:
    // https://github.com/thehubbleproject/hubble-bls/pull/20
    tx.signature = otherTx.signature;

    assertEquals(await txService.readyTxTable.count(), 0n);

    const failures = await txService.add(tx);

    assertEquals(
      failures.map((f) => f.type).sort(),
      ["duplicate-nonce", "invalid-signature"],
    );

    // Transaction table remains empty
    assertEquals(await txService.readyTxTable.count(), 0n);
  },
);

Fixture.test("adds tx with future nonce to futureTxs", async (fx) => {
  const txService = await fx.createTxService();
  const [wallet] = await fx.setupWallets(1);

  const tx = wallet.sign({
    contract: fx.testErc20.contract,
    method: "mint",
    args: [wallet.address, "3"],
    nonce: (await wallet.Nonce()).add(1),
  });

  assertEquals(await txService.readyTxTable.count(), 0n);
  assertEquals(await txService.futureTxTable.count(), 0n);

  const failures = await txService.add(tx);
  assertEquals(failures, []);

  assertEquals(await txService.readyTxTable.count(), 0n);
  assertEquals(await txService.futureTxTable.count(), 1n);
});

Fixture.test(
  "filling the nonce gap adds the eligible future tx to the end of ready txs",
  async (fx) => {
    const txService = await fx.createTxService();
    const [wallet, otherWallet] = await fx.setupWallets(2);

    assertEquals(await fx.allTxs(txService), {
      ready: [],
      future: [],
    });

    const walletNonce = await wallet.Nonce();

    // Add tx in the future
    const txB = wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "3"],
      nonce: walletNonce.add(1),
    });

    const failuresB = await txService.add(txB);
    assertEquals(failuresB, []);

    // This tx is ready, so it should get to go first even though the tx above
    // was added first.
    const otherTx = otherWallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [otherWallet.address, "3"],
      nonce: await otherWallet.Nonce(),
    });

    const otherFailures = await txService.add(otherTx);
    assertEquals(otherFailures, []);

    assertEquals(await fx.allTxs(txService), {
      ready: [otherTx],
      future: [txB],
    });

    // Add txA, which makes txB ready
    const txA = wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "3"],
      nonce: walletNonce,
    });

    const failuresA = await txService.add(txA);
    assertEquals(failuresA, []);

    assertEquals(await fx.allTxs(txService), {
      ready: [
        otherTx,
        txA,

        // Note that txB had id 1 when it was future, and it gets a new id here
        txB,
      ],
      future: [],
    });
  },
);

Fixture.test(
  "when future txs reach maxFutureTxs, the oldest ones are dropped",
  async (fx) => {
    const txService = await fx.createTxService({
      ...TxService.defaultConfig,
      maxFutureTxs: 3,
    });

    const [wallet] = await fx.setupWallets(1);

    const walletNonce = await wallet.Nonce();

    const futureTxs = Range(5).map((i) =>
      wallet.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [wallet.address, "3"],
        nonce: walletNonce.add(i + 1),
      })
    );

    for (const tx of futureTxs) {
      await txService.add(tx);
    }

    assertEquals(await fx.allTxs(txService), {
      ready: [],
      future: [
        // futureTxs[0] and futureTxs[1] should have been dropped
        futureTxs[2],
        futureTxs[3],
        futureTxs[4],
      ],
    });
  },
);

function fillGapToEnableMultipleFutureTxsTest(futureTxCount: number) {
  Fixture.test(
    [
      "filling the nonce gap adds multiple eligible future txs",
      `(futureTxCount: ${futureTxCount})`,
    ].join(" "),
    async (fx) => {
      const txService = await fx.createTxService({
        ...TxService.defaultConfig,
        // Small query limit forces multiple batches when processing the
        // future txs, checking that batching works correctly
        txQueryLimit: 2,

        // Prevent batching to focus on testing which table txs land in
        maxAggregationSize: 100,
      });

      const [wallet] = await fx.setupWallets(1);
      const walletNonce = await wallet.Nonce();

      assertEquals(await fx.allTxs(txService), {
        ready: [],
        future: [],
      });

      // Add multiple txs in the future (and out of order)

      const futureTxs = [];

      for (const i of Range(futureTxCount)) {
        const futureTx = wallet.sign({
          contract: fx.testErc20.contract,
          method: "mint",
          args: [wallet.address, "3"],
          nonce: walletNonce.add(futureTxCount - i),
        });

        const failures = await txService.add(futureTx);
        assertEquals(failures, []);

        futureTxs.push(futureTx);
      }

      assertEquals(await fx.allTxs(txService), {
        ready: [],
        future: futureTxs,
      });

      // Add tx, which makes futureTxs ready
      const tx = wallet.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [wallet.address, "3"],
        nonce: walletNonce,
      });

      const failures = await txService.add(tx);
      assertEquals(failures, []);

      assertEquals(await fx.allTxs(txService), {
        ready: [tx, ...futureTxs.slice().reverse()],
        future: [],
      });
    },
  );
}

fillGapToEnableMultipleFutureTxsTest(3);
fillGapToEnableMultipleFutureTxsTest(4);

Fixture.test(
  "filling the nonce gap adds eligible future tx but stops at the next gap",
  async (fx) => {
    const txService = await fx.createTxService();
    const [wallet] = await fx.setupWallets(1);
    const walletNonce = await wallet.Nonce();

    assertEquals(await fx.allTxs(txService), {
      ready: [],
      future: [],
    });

    // Add multiple txs in the future (and out of order)
    const tx4 = wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "3"],
      nonce: walletNonce.add(3),
    });

    const failures4 = await txService.add(tx4);
    assertEquals(failures4, []);

    const tx2 = wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "3"],
      nonce: walletNonce.add(1),
    });

    const failures2 = await txService.add(tx2);
    assertEquals(failures2, []);

    assertEquals(await fx.allTxs(txService), {
      ready: [],
      future: [tx4, tx2],
    });

    // Add tx1, which makes earlier txs ready
    const tx1 = wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "3"],
      nonce: walletNonce,
    });

    const failures1 = await txService.add(tx1);
    assertEquals(failures1, []);

    assertEquals(await fx.allTxs(txService), {
      ready: [tx1, tx2],
      future: [tx4],
    });
  },
);

Fixture.test(
  [
    "concurrently request many contiguous txs in a jumbled order - all find",
    "their way to ready and don't get stuck in future",
  ].join(" "),
  async (fx) => {
    const txService = await fx.createTxService({
      ...TxService.defaultConfig,

      // Prevent batching to focus on testing which table txs land in
      maxAggregationSize: 100,
    });

    const [wallet] = await fx.setupWallets(1);
    const walletNonce = await wallet.Nonce();

    const txs = fx.rng.shuffle(Range(10)).map((i) =>
      wallet.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [wallet.address, "1"],
        nonce: walletNonce.add(i),
      })
    );

    const allFailures = await Promise.all(txs.map((tx) => txService.add(tx)));
    assertEquals(allFailures.flat(), []);

    const sortedTxs = txs.slice().sort((txA, txB) =>
      txA.nonce.sub(txB.nonce).toNumber()
    );

    assertEquals(await fx.allTxs(txService), {
      ready: sortedTxs,
      future: [],
    });
  },
);
