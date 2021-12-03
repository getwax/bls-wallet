import TxService from "../src/app/TxService.ts";
import { assertEquals } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";
import Range from "../src/helpers/Range.ts";

Fixture.test(
  "reusing a nonce from ready txs with a higher reward replaces the tx",
  async (fx) => {
    const txService = await fx.createBundleService();
    const [wallet] = await fx.setupWallets(1);
    let walletNonce = await wallet.Nonce();

    await fx.ethereumService.sendTxs([
      wallet.sign({
        contract: fx.rewardErc20.contract,
        method: "mint",
        args: [wallet.address, "1"],
        nonce: walletNonce,
      }),
    ]);

    walletNonce = walletNonce.add(1);

    const tx = wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "3"],
      nonce: walletNonce,
    });

    const failures = await txService.add(tx);
    assertEquals(failures, []);

    assertEquals(await fx.allTxs(txService), {
      ready: [tx],
      future: [],
    });

    const txReplacement = wallet.sign({
      contract: fx.testErc20.contract,
      method: "mint",
      args: [wallet.address, "5"],
      // Reward removed because they need to be introduced in a different way,
      // however this should still work because TxService considers the new tx
      // to have a higher reward for now.
      nonce: walletNonce,
    });

    const failuresReplacement = await txService.add(txReplacement);
    assertEquals(failuresReplacement, []);

    assertEquals(await fx.allTxs(txService), {
      ready: [txReplacement],
      future: [],
    });
  },
);

function reinsertionTest(extraTxs: number) {
  Fixture.test(
    [
      "replacing a tx causes reinsertion of following txs to fix order",
      `(extraTxs: ${extraTxs})`,
    ].join(" "),
    async (fx) => {
      const txService = await fx.createBundleService({
        ...TxService.defaultConfig,
        // Small query limit forces multiple submissions when processing the
        // reinsertion, checking that submitting works correctly
        txQueryLimit: 2,

        // Prevent submitting to focus on testing which table txs land in
        maxAggregationSize: 100,
      });

      const [w1, w2] = await fx.setupWallets(2);
      const w1Nonce = await w1.Nonce();

      const txs = Range(2 + extraTxs).map((i) =>
        w1.sign({
          contract: fx.testErc20.contract,
          method: "mint",
          args: [w1.address, `${i}`],
          nonce: w1Nonce.add(i),
        })
      );

      const txOther = w2.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [w2.address, "1"],
        nonce: await w2.Nonce(),
      });

      for (const tx of [...txs, txOther]) {
        const failures = await txService.add(tx);
        assertEquals(failures, []);
      }

      assertEquals(await fx.allTxs(txService), {
        ready: [...txs, txOther],
        future: [],
      });

      // Now replace txs[1] and the replacement should be at the end but also
      // all the extraTxs should be moved to the end.

      const txReplacement = w1.sign({
        contract: fx.testErc20.contract,
        method: "mint",
        args: [w1.address, "11"],
        nonce: w1Nonce.add(1),
      });

      const failures = await txService.add(txReplacement);

      assertEquals(failures, []);

      assertEquals(await fx.allTxs(txService), {
        ready: [
          txs[0],
          txOther,
          txReplacement,
          ...txs.slice(2),
        ],
        future: [],
      });
    },
  );
}

reinsertionTest(3);
reinsertionTest(4);
