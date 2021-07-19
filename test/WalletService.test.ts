import { assert, assertEquals, BigNumber, ethers } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("WalletService gets aggregator balance", async (fx) => {
  assert(
    (await fx.walletService.getAggregatorBalance()).gt(0),
  );
});

Fixture.test("WalletService sends single transaction", async (fx) => {
  const blsSigner = fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  const tx = await fx.createTxData({
    blsSigner,
    contract: fx.walletService.erc20,
    method: "mint",
    args: [blsWallet.address, "7"],
    nonceOffset: 0,
  });

  await fx.walletService.sendTx(tx);

  const balance: BigNumber = await fx.walletService.erc20.balanceOf(
    blsWallet.address,
  );

  assertEquals(balance.toNumber(), 7);
});

Fixture.test("WalletService sends aggregate transaction", async (fx) => {
  const blsSigner = fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  const tx1 = await fx.createTxData({
    blsSigner,
    contract: fx.walletService.erc20,
    method: "mint",
    args: [blsWallet.address, "3"],
    nonceOffset: 0,
  });

  const tx2 = await fx.createTxData({
    blsSigner,
    contract: fx.walletService.erc20,
    method: "mint",
    args: [blsWallet.address, "5"],
    nonceOffset: 1,
  });

  await fx.walletService.sendTxs([tx1, tx2]);

  const balance: BigNumber = await fx.walletService.erc20.balanceOf(
    blsWallet.address,
  );

  assertEquals(balance.toNumber(), 8);
});

Fixture.test(
  "WalletService sends aggregate transaction with token rewards",
  async (fx) => {
    const [{ blsSigner, blsWallet }] = await fx.setupWallets(1);

    const tx1 = await fx.createTxData({
      blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [blsWallet.address, "3"],
      tokenRewardAmount: ethers.BigNumber.from(8),
      nonceOffset: 0,
    });

    const tx2 = await fx.createTxData({
      blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [blsWallet.address, "5"],
      tokenRewardAmount: ethers.BigNumber.from(13),
      nonceOffset: 1,
    });

    await fx.walletService.sendTxs([tx1, tx2]);

    assertEquals(
      (await fx.walletService.erc20.balanceOf(blsWallet.address)).toNumber(),
      1008,
    );

    assertEquals(
      (await fx.walletService.rewardErc20.balanceOf(blsWallet.address))
        .toNumber(),
      1000 - 21,
    );
  },
);
