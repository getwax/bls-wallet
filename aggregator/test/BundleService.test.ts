import { assertBundleSucceeds, assertEquals, Operation } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("adds valid bundle", async (fx) => {
  const bundleService = fx.createBundleService();
  const [wallet] = await fx.setupWallets(1);

  const tx = wallet.sign({
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

  assertEquals(await bundleService.bundleTable.count(), 0);

  assertBundleSucceeds(await bundleService.add(tx));

  assertEquals(await bundleService.bundleTable.count(), 1);
});

Fixture.test("rejects bundle with invalid signature", async (fx) => {
  const bundleService = fx.createBundleService();
  const [wallet, otherWallet] = await fx.setupWallets(2);

  const operation: Operation = {
    nonce: await wallet.Nonce(),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [wallet.address, "3"],
        ),
      },
    ],
  };

  const tx = wallet.sign(operation);
  const otherTx = otherWallet.sign(operation);

  // Make the signature invalid
  // Note: Bug in bls prevents just corrupting the signature (see other invalid
  // sig test)
  tx.signature = otherTx.signature;

  assertEquals(await bundleService.bundleTable.count(), 0);

  const res = await bundleService.add(tx);
  if ("hash" in res) {
    throw new Error("expected bundle to fail");
  }
  assertEquals(res.failures.map((f) => f.type), ["invalid-signature"]);

  // Bundle table remains empty
  assertEquals(await bundleService.bundleTable.count(), 0);
});

Fixture.test("rejects bundle with nonce from the past", async (fx) => {
  const bundleService = fx.createBundleService();
  const [wallet] = await fx.setupWallets(1);

  const tx = wallet.sign({
    nonce: (await wallet.Nonce()).sub(1),
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

  assertEquals(await bundleService.bundleTable.count(), 0);

  const res = await bundleService.add(tx);
  if ("hash" in res) {
    throw new Error("expected bundle to fail");
  }
  assertEquals(res.failures.map((f) => f.type), ["duplicate-nonce"]);

  // Bundle table remains empty
  assertEquals(await bundleService.bundleTable.count(), 0);
});

Fixture.test(
  "rejects bundle with invalid signature and nonce from the past",
  async (fx) => {
    const bundleService = fx.createBundleService();
    const [wallet, otherWallet] = await fx.setupWallets(2);

    const operation: Operation = {
      nonce: (await wallet.Nonce()).sub(1),
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
    };

    const tx = wallet.sign(operation);
    const otherTx = otherWallet.sign(operation);

    // Use signature from otherTx to make it invalid
    // Note: It would be faster to corrupt the existing signature than set up
    // another wallet, but there is a bug in hubbleBls that throws instead of
    // returning false when you do that:
    // https://github.com/thehubbleproject/hubble-bls/pull/20
    tx.signature = otherTx.signature;

    assertEquals(await bundleService.bundleTable.count(), 0);

    const res = await bundleService.add(tx);
    if ("hash" in res) {
      throw new Error("expected bundle to fail");
    }

    assertEquals(
      res.failures.map((f) => f.type).sort(),
      ["duplicate-nonce", "invalid-signature"],
    );

    // Bundle table remains empty
    assertEquals(await bundleService.bundleTable.count(), 0);
  },
);

Fixture.test("adds bundle with future nonce", async (fx) => {
  const bundleService = fx.createBundleService();
  const [wallet] = await fx.setupWallets(1);

  const tx = wallet.sign({
    nonce: (await wallet.Nonce()).add(1),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [wallet.address, "3"],
        ),
      },
    ],
  });

  assertEquals(await bundleService.bundleTable.count(), 0);

  assertBundleSucceeds(await bundleService.add(tx));

  assertEquals(await bundleService.bundleTable.count(), 1);
});

// TODO (merge-ok): Add a mechanism for limiting the number of stored
// transactions (and add a new test for it).
// Fixture.test(
//   "when future txs reach maxFutureTxs, the oldest ones are dropped",
//   async (fx) => {
//     const bundleService = fx.createBundleService({
//       ...BundleService.defaultConfig,
//       maxFutureTxs: 3,
//     });

//     const [wallet] = await fx.setupWallets(1);

//     const walletNonce = await wallet.Nonce();

//     const futureTxs = Range(5).map((i) =>
//       wallet.sign({
//         contract: fx.testErc20,
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
