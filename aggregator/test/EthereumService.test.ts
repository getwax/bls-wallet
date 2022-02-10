import { assertEquals, BigNumber } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";
import Range from "../src/helpers/Range.ts";

Fixture.test("EthereumService submits mint action", async (fx) => {
  const [wallet] = await fx.setupWallets(1);
  const startBalance = await fx.testErc20.balanceOf(wallet.address);

  const bundle = wallet.sign({
    nonce: await wallet.Nonce(),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [wallet.address, 7],
        ),
      },
    ],
  });

  await fx.ethereumService.submitBundle(bundle);

  const balance: BigNumber = await fx.testErc20.balanceOf(wallet.address);

  assertEquals(balance.toNumber(), startBalance.toNumber() + 7);
});

Fixture.test("EthereumService submits transfer action", async (fx) => {
  const wallets = await fx.setupWallets(2);

  const bundle = wallets[0].sign({
    nonce: await wallets[0].Nonce(),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "transfer",
          [wallets[1].address, 1],
        ),
      },
    ],
  });

  await fx.ethereumService.submitBundle(bundle);

  const balances: BigNumber[] = await Promise.all(wallets.map(
    (w) => fx.testErc20.balanceOf(w.address),
  ));

  assertEquals(balances.map((b) => b.toNumber()), [999, 1001]);
});

Fixture.test("EthereumService submits aggregated bundle", async (fx) => {
  const [wallet] = await fx.setupWallets(1);
  const walletNonce = await wallet.Nonce();

  const bundle = fx.blsWalletSigner.aggregate([
    wallet.sign({
      nonce: walletNonce,
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
    }),
    wallet.sign({
      nonce: walletNonce.add(1),
      actions: [
        {
          ethValue: 0,
          contractAddress: fx.testErc20.address,
          encodedFunction: fx.testErc20.interface.encodeFunctionData(
            "mint",
            [wallet.address, 5],
          ),
        },
      ],
    }),
  ]);

  await fx.ethereumService.submitBundle(bundle);

  const balance = await fx.testErc20.balanceOf(wallet.address);

  assertEquals(balance.toNumber(), 1008);
});

Fixture.test("EthereumService submits large aggregate mint bundle", async (fx) => {
  const [wallet] = await fx.setupWallets(1);
  const walletNonce = await wallet.Nonce();

  const size = 11;

  const bundle = fx.blsWalletSigner.aggregate(
    Range(size).map((i) =>
      wallet.sign({
        nonce: walletNonce.add(i),
        actions: [
          // TODO (merge-ok): Add single operation multi-action variation of this test
          {
            ethValue: 0,
            contractAddress: fx.testErc20.address,
            encodedFunction: fx.testErc20.interface.encodeFunctionData(
              "mint",
              [wallet.address, 1],
            ),
          },
        ],
      })
    ),
  );

  await fx.ethereumService.submitBundle(bundle);

  const balance: BigNumber = await fx.testErc20.balanceOf(wallet.address);

  assertEquals(balance.toNumber(), 1000 + size);
});

Fixture.test("EthereumService sends large aggregate transfer bundle", async (fx) => {
  const [sendWallet, recvWallet] = await fx.setupWallets(2);
  const sendWalletNonce = await sendWallet.Nonce();

  const size = 29;

  const bundle = fx.blsWalletSigner.aggregate(
    Range(size).map((i) =>
      sendWallet.sign({
        nonce: sendWalletNonce.add(i),
        actions: [
          {
            ethValue: 0,
            contractAddress: fx.testErc20.address,
            encodedFunction: fx.testErc20.interface.encodeFunctionData(
              "transfer",
              [recvWallet.address, 1],
            ),
          },
        ],
      })
    ),
  );

  await fx.ethereumService.submitBundle(bundle);

  const balance: BigNumber = await fx.testErc20.balanceOf(recvWallet.address);

  assertEquals(balance.toNumber(), 1000 + size);
});

Fixture.test(
  "EthereumService sends multiple aggregate transactions",
  async (fx) => {
    const [wallet] = await fx.setupWallets(1);

    for (let i = 1; i <= 2; i++) {
      const walletNonce = await wallet.Nonce();

      const bundle = fx.blsWalletSigner.aggregate(
        Range(5).map((i) =>
          wallet.sign({
            nonce: walletNonce.add(i),
            actions: [
              {
                ethValue: 0,
                contractAddress: fx.testErc20.address,
                encodedFunction: fx.testErc20.interface
                  .encodeFunctionData(
                    "mint",
                    [wallet.address, "1"],
                  ),
              },
            ],
          })
        ),
      );

      await fx.ethereumService.submitBundle(bundle);

      const balance: BigNumber = await fx.testErc20.balanceOf(wallet.address);

      assertEquals(balance.toNumber(), 1000 + i * 5);
    }
  },
);

// FIXME (merge-ok): This test is flaky but I think it's just the optimism dev
// environment being weird - it seems to reject txs based on confirmed state
// only sometimes. This causes tx2,tx3 to fail because it says tx3 will fail the
// sig check because it gets the wrong nonce because tx2 hasn't been confirmed.
// Fixture.test(
//   "EthereumService can concurrently send txs with consecutive nonces",
//   async (fx) => {
//     const [wallet] = await fx.setupWallets(1);
//     const walletNonce = await wallet.Nonce();

//     const txs = Range(2).map((i) =>
//       wallet.sign({
//         contract: fx.testErc20,
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

//         await fx.ethereumService.sendTxs([tx], 10, 300);
//       }),
//     );

//     const balance = await fx.testErc20.balanceOf(wallet.address);

//     assertEquals(balance.toNumber(), 1002);
//   },
// );

Fixture.test("callStaticSequence - correctly measures transfer", async (fx) => {
  const [sendWallet, recvWallet] = await fx.setupWallets(2);
  const transferAmount = 5;

  await (await fx.adminWallet.sendTransaction({
    to: sendWallet.address,
    value: transferAmount,
  })).wait();

  const results = await fx.ethereumService.callStaticSequence(
    fx.ethereumService.Call(fx.ethereumService.utilities, "ethBalanceOf", [
      recvWallet.address,
    ]),
    fx.ethereumService.Call(
      fx.ethereumService.verificationGateway,
      "processBundle",
      [sendWallet.sign({
        nonce: await sendWallet.Nonce(),
        actions: [
          {
            ethValue: transferAmount,
            contractAddress: recvWallet.address,
            encodedFunction: [],
          },
        ],
      })],
    ),
    fx.ethereumService.Call(fx.ethereumService.utilities, "ethBalanceOf", [
      recvWallet.address,
    ]),
  );

  const [[balanceBefore], , [balanceAfter]] = results;

  assertEquals(balanceAfter.sub(balanceBefore).toNumber(), transferAmount);
});
