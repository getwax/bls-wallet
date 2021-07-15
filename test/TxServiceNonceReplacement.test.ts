import { assertEquals, ethers } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

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
