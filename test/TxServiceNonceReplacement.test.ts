import { assertEquals, ethers } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";
import Range from "./helpers/Range.ts";

Fixture.test(
  "reusing a nonce from ready txs fails with insufficient-reward",
  async (fx) => {
    const txService = await fx.createTxService();

    const blsSigner = fx.createBlsSigner();
    const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

    const tx = await fx.createTxData({
      blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [blsWallet.address, "3"],
    });

    const failures = await txService.add(tx);
    assertEquals(failures, []);

    const txDuplicateNonce = await fx.createTxData({
      blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [blsWallet.address, "5"],
      // because the previous tx isn't on chain, the default nonce offset of
      // zero should conflict
    });

    const failuresDuplicateNonce = await txService.add(txDuplicateNonce);

    assertEquals(
      failuresDuplicateNonce.map((f) => f.type),
      ["insufficient-reward"],
    );

    assertEquals(await fx.allTxs(txService), {
      ready: [{ ...tx, txId: 1 }],
      future: [],
    });
  },
);

Fixture.test(
  "reusing a nonce from ready txs with a higher reward replaces the tx",
  async (fx) => {
    const txService = await fx.createTxService();

    const blsSigner = fx.createBlsSigner();
    const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

    await fx.walletService.sendTx(
      await fx.createTxData({
        blsSigner,
        contract: fx.walletService.rewardErc20,
        method: "mint",
        args: [blsWallet.address, "1"],
      }),
    );

    const tx = await fx.createTxData({
      blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [blsWallet.address, "3"],
    });

    const failures = await txService.add(tx);
    assertEquals(failures, []);

    assertEquals(await fx.allTxs(txService), {
      ready: [{ ...tx, txId: 1 }],
      future: [],
    });

    const txReplacement = await fx.createTxData({
      blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [blsWallet.address, "5"],
      // because the previous tx isn't on chain, the default nonce offset of
      // zero should conflict
      tokenRewardAmount: ethers.BigNumber.from(1),
    });

    const failuresReplacement = await txService.add(txReplacement);
    assertEquals(failuresReplacement, []);

    assertEquals(await fx.allTxs(txService), {
      ready: [{ ...txReplacement, txId: 2 }],
      future: [],
    });
  },
);

Fixture.test(
  [
    "reusing a nonce from ready txs with a lower reward fails with",
    "insufficient-reward",
  ].join(" "),
  async (fx) => {
    const txService = await fx.createTxService();

    const [{ blsSigner, blsWallet }] = await fx.setupWallets(1);

    const tx = await fx.createTxData({
      blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [blsWallet.address, "3"],
      tokenRewardAmount: ethers.BigNumber.from(2),
    });

    const failures = await txService.add(tx);
    assertEquals(failures, []);

    assertEquals(await fx.allTxs(txService), {
      ready: [{ ...tx, txId: 1 }],
      future: [],
    });

    const txReplacement = await fx.createTxData({
      blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [blsWallet.address, "5"],
      // because the previous tx isn't on chain, the default nonce offset of
      // zero should conflict
      tokenRewardAmount: ethers.BigNumber.from(1),
    });

    const failuresReplacement = await txService.add(txReplacement);

    assertEquals(
      failuresReplacement.map((f) => f.type),
      ["insufficient-reward"],
    );

    assertEquals(await fx.allTxs(txService), {
      ready: [{ ...tx, txId: 1 }],
      future: [],
    });
  },
);

Fixture.test(
  "replacing a tx causes reinsertion of following txs to fix order",
  async (fx) => {
    const txService = await fx.createTxService({
      // Small query limit forces multiple batches when processing the
      // reinsertion, checking that batching works correctly
      txQueryLimit: 2,
      maxFutureTxs: 1000,
    });

    const [w1, w2] = await fx.setupWallets(2);

    const txs = await Promise.all(
      Range(5).map((i) =>
        fx.createTxData({
          blsSigner: w1.blsSigner,
          contract: fx.walletService.erc20,
          method: "mint",
          args: [w1.blsWallet.address, `${i}`],
          nonceOffset: i,
        })
      ),
    );

    const txOther = await fx.createTxData({
      blsSigner: w2.blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [w1.blsWallet.address, "1"],
    });

    for (const tx of [...txs, txOther]) {
      const failures = await txService.add(tx);
      assertEquals(failures, []);
    }

    assertEquals(await fx.allTxs(txService), {
      ready: [
        { ...txs[0], txId: 1 },
        { ...txs[1], txId: 2 },
        { ...txs[2], txId: 3 },
        { ...txs[3], txId: 4 },
        { ...txs[4], txId: 5 },
        { ...txOther, txId: 6 },
      ],
      future: [],
    });

    // Now replace txs[1] and the replacement should be at the end but also
    // txs[2] should be moved to the end.

    const txReplacement = await fx.createTxData({
      blsSigner: w1.blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [w1.blsWallet.address, "11"],
      nonceOffset: 1,
      tokenRewardAmount: ethers.BigNumber.from(1),
    });

    const failures = await txService.add(txReplacement);

    assertEquals(failures, []);

    assertEquals(await fx.allTxs(txService), {
      ready: [
        { ...txs[0], txId: 1 },
        { ...txOther, txId: 6 },
        { ...txReplacement, txId: 7 },
        { ...txs[2], txId: 8 },
        { ...txs[3], txId: 9 },
        { ...txs[4], txId: 10 },
      ],
      future: [],
    });
  },
);
