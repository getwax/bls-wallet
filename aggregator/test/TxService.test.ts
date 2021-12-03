import { assertEquals } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("adds valid transaction", async (fx) => {
  const bundleService = await fx.createBundleService();
  const [wallet] = await fx.setupWallets(1);

  const tx = wallet.sign({
    contract: fx.testErc20.contract,
    method: "mint",
    args: [wallet.address, "3"],
    nonce: await wallet.Nonce(),
  });

  assertEquals(await bundleService.readyTxTable.count(), 0n);

  const failures = await bundleService.add(tx);
  assertEquals(failures, []);

  assertEquals(await bundleService.readyTxTable.count(), 1n);
});

Fixture.test("rejects transaction with invalid signature", async (fx) => {
  const bundleService = await fx.createBundleService();
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

  assertEquals(await bundleService.readyTxTable.count(), 0n);

  const failures = await bundleService.add(tx);
  assertEquals(failures.map((f) => f.type), ["invalid-signature"]);

  // Transaction table remains empty
  assertEquals(await bundleService.readyTxTable.count(), 0n);
});

Fixture.test("rejects transaction with nonce from the past", async (fx) => {
  const bundleService = await fx.createBundleService();
  const [wallet] = await fx.setupWallets(1);

  const tx = wallet.sign({
    contract: fx.testErc20.contract,
    method: "mint",
    args: [wallet.address, "3"],
    nonce: (await wallet.Nonce()).sub(1),
  });

  assertEquals(await bundleService.readyTxTable.count(), 0n);

  const failures = await bundleService.add(tx);
  assertEquals(failures.map((f) => f.type), ["duplicate-nonce"]);

  // Transaction table remains empty
  assertEquals(await bundleService.readyTxTable.count(), 0n);
});

Fixture.test(
  "rejects transaction with invalid signature and nonce from the past",
  async (fx) => {
    const bundleService = await fx.createBundleService();
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

    assertEquals(await bundleService.readyTxTable.count(), 0n);

    const failures = await bundleService.add(tx);

    assertEquals(
      failures.map((f) => f.type).sort(),
      ["duplicate-nonce", "invalid-signature"],
    );

    // Transaction table remains empty
    assertEquals(await bundleService.readyTxTable.count(), 0n);
  },
);

Fixture.test("adds tx with future nonce", async (fx) => {
  const bundleService = await fx.createBundleService();
  const [wallet] = await fx.setupWallets(1);

  const tx = wallet.sign({
    contract: fx.testErc20.contract,
    method: "mint",
    args: [wallet.address, "3"],
    nonce: (await wallet.Nonce()).add(1),
  });

  assertEquals(await bundleService.readyTxTable.count(), 0n);
  assertEquals(await bundleService.futureTxTable.count(), 0n);

  const failures = await bundleService.add(tx);
  assertEquals(failures, []);

  assertEquals(await bundleService.readyTxTable.count(), 0n);
  assertEquals(await bundleService.futureTxTable.count(), 1n);
});

// TODO: Add a mechanism for limiting the number of stored transactions
// Fixture.test(
//   "when future txs reach maxFutureTxs, the oldest ones are dropped",
//   async (fx) => {
//     const bundleService = await fx.createBundleService({
//       ...BundleService.defaultConfig,
//       maxFutureTxs: 3,
//     });

//     const [wallet] = await fx.setupWallets(1);

//     const walletNonce = await wallet.Nonce();

//     const futureTxs = Range(5).map((i) =>
//       wallet.sign({
//         contract: fx.testErc20.contract,
//         method: "mint",
//         args: [wallet.address, "3"],
//         nonce: walletNonce.add(i + 1),
//       })
//     );

//     for (const tx of futureTxs) {
//       await bundleService.add(tx);
//     }

//     assertEquals(await fx.allTxs(bundleService), {
//       ready: [],
//       future: [
//         // futureTxs[0] and futureTxs[1] should have been dropped
//         futureTxs[2],
//         futureTxs[3],
//         futureTxs[4],
//       ],
//     });
//   },
// );
