import { assertEquals, BigNumber, delay, ethers } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";
import Range from "../src/helpers/Range.ts";

Fixture.test("WalletService sends single tx", async (fx) => {
  const blsSigner = fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  const tx = await fx.createTxData({
    blsSigner,
    contract: fx.testErc20,
    method: "mint",
    args: [blsWallet.address, "7"],
    nonceOffset: 0,
  });

  await fx.walletService.sendTx(tx);

  const balance: BigNumber = await fx.testErc20.balanceOf(
    blsWallet.address,
  );

  assertEquals(balance.toNumber(), 7);
});

Fixture.test("WalletService sends single transfer tx", async (fx) => {
  const wallets = await fx.setupWallets(2);

  const tx = await fx.createTxData({
    blsSigner: wallets[0].blsSigner,
    contract: fx.testErc20,
    method: "transfer",
    args: [wallets[1].blsWallet.address, "1"],
    nonceOffset: 0,
  });

  await fx.walletService.sendTx(tx);

  const balances: BigNumber[] = await Promise.all(wallets.map(
    (w) => fx.testErc20.balanceOf(w.blsWallet.address),
  ));

  assertEquals(balances.map((b) => b.toNumber()), [999, 1001]);
});

Fixture.test(
  "WalletService sends single transaction with token reward",
  async (fx) => {
    const [{ blsSigner, blsWallet }] = await fx.setupWallets(1);

    const tx = await fx.createTxData({
      blsSigner,
      contract: fx.testErc20,
      method: "mint",
      args: [blsWallet.address, "3"],
      tokenRewardAmount: ethers.BigNumber.from(8),
      nonceOffset: 0,
    });

    await fx.walletService.sendTx(tx);

    assertEquals(
      (await fx.testErc20.balanceOf(blsWallet.address)).toNumber(),
      1003,
    );

    assertEquals(
      (await fx.walletService.rewardErc20.balanceOf(blsWallet.address))
        .toNumber(),
      1000 - 8,
    );
  },
);

Fixture.test("WalletService sends aggregate transaction", async (fx) => {
  const blsSigner = fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  const tx1 = await fx.createTxData({
    blsSigner,
    contract: fx.testErc20,
    method: "mint",
    args: [blsWallet.address, "3"],
    nonceOffset: 0,
  });

  const tx2 = await fx.createTxData({
    blsSigner,
    contract: fx.testErc20,
    method: "mint",
    args: [blsWallet.address, "5"],
    nonceOffset: 1,
  });

  await fx.walletService.sendTxs([tx1, tx2]);

  const balance: BigNumber = await fx.testErc20.balanceOf(
    blsWallet.address,
  );

  assertEquals(balance.toNumber(), 8);
});

Fixture.test("WalletService sends large aggregate mint tx", async (fx) => {
  const blsSigner = fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  const size = 11;

  const txs = await Promise.all(
    Range(size).map((i) =>
      fx.createTxData({
        blsSigner,
        contract: fx.testErc20,
        method: "mint",
        args: [blsWallet.address, "1"],
        nonceOffset: i,
      })
    ),
  );

  await fx.walletService.sendTxs(txs);

  const balance: BigNumber = await fx.testErc20.balanceOf(
    blsWallet.address,
  );

  assertEquals(balance.toNumber(), size);
});

Fixture.test("WalletService sends large aggregate transfer tx", async (fx) => {
  const [sendWallet, recvWallet] = await fx.setupWallets(2);

  const size = 12;

  const txs = await Promise.all(
    Range(size).map((i) =>
      fx.createTxData({
        blsSigner: sendWallet.blsSigner,
        contract: fx.testErc20,
        method: "transfer",
        args: [recvWallet.blsWallet.address, "1"],
        nonceOffset: i,
      })
    ),
  );

  await fx.walletService.sendTxs(txs);

  const balance: BigNumber = await fx.testErc20.balanceOf(
    recvWallet.blsWallet.address,
  );

  assertEquals(balance.toNumber(), 1000 + size);
});

Fixture.test(
  "WalletService sends multiple aggregate transactions",
  async (fx) => {
    const blsSigner = fx.createBlsSigner();
    const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

    for (let i = 1; i <= 2; i++) {
      const txs = await Promise.all(
        Range(5).map((i) =>
          fx.createTxData({
            blsSigner,
            contract: fx.testErc20,
            method: "mint",
            args: [blsWallet.address, "1"],
            nonceOffset: i,
          })
        ),
      );

      await fx.walletService.sendTxs(txs);

      const balance: BigNumber = await fx.testErc20.balanceOf(
        blsWallet.address,
      );

      assertEquals(balance.toNumber(), i * 5);
    }
  },
);

Fixture.test(
  "WalletService sends aggregate transaction with token rewards",
  async (fx) => {
    const [{ blsSigner, blsWallet }] = await fx.setupWallets(1);

    const tx1 = await fx.createTxData({
      blsSigner,
      contract: fx.testErc20,
      method: "mint",
      args: [blsWallet.address, "3"],
      tokenRewardAmount: ethers.BigNumber.from(8),
      nonceOffset: 0,
    });

    const tx2 = await fx.createTxData({
      blsSigner,
      contract: fx.testErc20,
      method: "mint",
      args: [blsWallet.address, "5"],
      tokenRewardAmount: ethers.BigNumber.from(13),
      nonceOffset: 1,
    });

    await fx.walletService.sendTxs([tx1, tx2]);

    assertEquals(
      (await fx.testErc20.balanceOf(blsWallet.address)).toNumber(),
      1008,
    );

    assertEquals(
      (await fx.walletService.rewardErc20.balanceOf(blsWallet.address))
        .toNumber(),
      1000 - 21,
    );
  },
);

Fixture.test(
  "WalletService can concurrently send txs with consecutive nonces",
  async (fx) => {
    const [{ blsSigner, blsWallet }] = await fx.setupWallets(1);

    const txs = await Promise.all(
      Range(2).map((i) =>
        fx.createTxData({
          blsSigner,
          contract: fx.testErc20,
          method: "mint",
          args: [blsWallet.address, "1"],
          nonceOffset: i,
        })
      ),
    );

    await Promise.all(
      txs.map(async (tx, i) => {
        // Stagger the txs slightly so that they are likely to arrive in order
        // but are still trying to get into the same block
        await delay(100 * i);

        await fx.walletService.sendTxs([tx], 10, 300);
      }),
    );

    const balance: ethers.BigNumber = await fx.testErc20.balanceOf(
      blsWallet.address,
    );

    assertEquals(balance.toNumber(), 1002);
  },
);
