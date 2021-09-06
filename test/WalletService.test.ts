import { assertEquals, BigNumber } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";
import Range from "../src/helpers/Range.ts";

Fixture.test("WalletService sends single tx", async (fx) => {
  const [wallet] = await fx.setupWallets(1);
  const startBalance = await fx.testErc20.balanceOf(wallet.address);

  const tx = wallet.sign({
    contract: fx.testErc20.contract,
    method: "mint",
    args: [wallet.address, "7"],
    nonce: await wallet.Nonce(),
  });

  await fx.walletService.sendTx(tx);

  const balance: BigNumber = await fx.testErc20.balanceOf(wallet.address);

  assertEquals(balance.toNumber(), startBalance.toNumber() + 7);
});

Fixture.test("WalletService sends single transfer tx", async (fx) => {
  const wallets = await fx.setupWallets(2);

  const tx = wallets[0].sign({
    contract: fx.testErc20.contract,
    method: "transfer",
    args: [wallets[1].address, "1"],
    nonce: await wallets[0].Nonce(),
  });

  await fx.walletService.sendTx(tx);

  const balances: BigNumber[] = await Promise.all(wallets.map(
    (w) => fx.testErc20.balanceOf(w.address),
  ));

  assertEquals(balances.map((b) => b.toNumber()), [999, 1001]);
});

Fixture.test(
  "WalletService sends single transaction with token reward",
  async (fx) => {
    const [wallet] = await fx.setupWallets(1);

    const tx = wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "3"],
      tokenRewardAmount: BigNumber.from(8),
      nonce: await wallet.Nonce(),
    });

    await fx.walletService.sendTx(tx);

    assertEquals(
      (await fx.testErc20.balanceOf(wallet.address)).toNumber(),
      1003,
    );

    assertEquals(
      (await fx.walletService.rewardErc20.balanceOf(wallet.address))
        .toNumber(),
      1000 - 8,
    );
  },
);

Fixture.test("WalletService sends aggregate transaction", async (fx) => {
  const [wallet] = await fx.setupWallets(1);
  const walletNonce = await wallet.Nonce();

  await fx.walletService.sendTxs([
    wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "3"],
      nonce: walletNonce,
    }),
    wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "5"],
      nonce: walletNonce.add(1),
    }),
  ]);

  const balance = await fx.testErc20.balanceOf(wallet.address);

  assertEquals(balance.toNumber(), 1008);
});

Fixture.test("WalletService sends large aggregate mint tx", async (fx) => {
  const [wallet] = await fx.setupWallets(1);
  const walletNonce = await wallet.Nonce();

  const size = 11;

  await fx.walletService.sendTxs(
    Range(size).map((i) =>
      wallet.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [wallet.address, "1"],
        nonce: walletNonce.add(i),
      })
    ),
  );

  const balance: BigNumber = await fx.testErc20.balanceOf(wallet.address);

  assertEquals(balance.toNumber(), 1000 + size);
});

Fixture.test("WalletService sends large aggregate transfer tx", async (fx) => {
  const [sendWallet, recvWallet] = await fx.setupWallets(2);
  const sendWalletNonce = await sendWallet.Nonce();

  const size = 12;

  await fx.walletService.sendTxs(
    Range(size).map((i) =>
      sendWallet.sign({
        contract: fx.testErc20.contract,
        method: "transfer",
        args: [recvWallet.address, "1"],
        nonce: sendWalletNonce.add(i),
      })
    ),
  );

  const balance: BigNumber = await fx.testErc20.balanceOf(recvWallet.address);

  assertEquals(balance.toNumber(), 1000 + size);
});

Fixture.test(
  "WalletService sends multiple aggregate transactions",
  async (fx) => {
    const [wallet] = await fx.setupWallets(1);

    for (let i = 1; i <= 2; i++) {
      const walletNonce = await wallet.Nonce();

      await fx.walletService.sendTxs(
        Range(5).map((i) =>
          wallet.sign({
            contract: fx.testErc20.contract,
            method: "mint",
            args: [wallet.address, "1"],
            nonce: walletNonce.add(i),
          })
        ),
      );

      const balance: BigNumber = await fx.testErc20.balanceOf(wallet.address);

      assertEquals(balance.toNumber(), 1000 + i * 5);
    }
  },
);

Fixture.test(
  "WalletService sends aggregate transaction with token rewards",
  async (fx) => {
    const [wallet] = await fx.setupWallets(1);
    const walletNonce = await wallet.Nonce();

    await fx.walletService.sendTxs([
      wallet.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [wallet.address, "3"],
        tokenRewardAmount: BigNumber.from(8),
        nonce: walletNonce,
      }),
      wallet.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [wallet.address, "5"],
        tokenRewardAmount: BigNumber.from(13),
        nonce: walletNonce.add(1),
      }),
    ]);

    assertEquals(
      (await fx.testErc20.balanceOf(wallet.address)).toNumber(),
      1008,
    );

    assertEquals(
      (await fx.walletService.rewardErc20.balanceOf(wallet.address))
        .toNumber(),
      1000 - 21,
    );
  },
);

// FIXME (merge-ok): This test is flaky but I think it's just the optimism dev
// environment being weird - it seems to reject txs based on confirmed state
// only sometimes. This causes tx2,tx3 to fail because it says tx3 will fail the
// sig check because it gets the wrong nonce because tx2 hasn't been confirmed.
// Fixture.test(
//   "WalletService can concurrently send txs with consecutive nonces",
//   async (fx) => {
//     const [wallet] = await fx.setupWallets(1);
//     const walletNonce = await wallet.Nonce();

//     const txs = Range(2).map((i) =>
//       wallet.sign({
//         contract: fx.testErc20.contract,
//         method: "mint",
//         args: [wallet.address, "1"],
//         nonce: walletNonce.add(i),
//       })
//     );

//     await Promise.all(
//       txs.map(async (tx, i) => {
//         // Stagger the txs slightly so that they are likely to arrive in order
//         // but are still trying to get into the same block
//         await delay(100 * i);

//         await fx.walletService.sendTxs([tx], 10, 300);
//       }),
//     );

//     const balance = await fx.testErc20.balanceOf(wallet.address);

//     assertEquals(balance.toNumber(), 1002);
//   },
// );
