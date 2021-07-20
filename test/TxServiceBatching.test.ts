import { assertEquals, ethers } from "./deps.ts";
import Fixture from "./helpers/Fixture.ts";

Fixture.test("submit a single transaction in a timed batch", async (fx) => {
  const txService = await fx.createTxService();
  const [{ blsSigner, blsWallet }] = await fx.setupWallets(1);

  const tx = await fx.createTxData({
    blsSigner,
    contract: fx.walletService.erc20,
    method: "mint",
    args: [blsWallet.address, "1"],
  });

  const failures = await txService.add(tx);
  assertEquals(failures, []);

  assertEquals(
    await fx.walletService.getBalanceOf(blsWallet.address),
    ethers.BigNumber.from(1000),
  );

  assertEquals(await fx.allTxs(txService), {
    ready: [{ ...tx, txId: 1 }],
    future: [],
  });

  fx.clock.advance(5000);
  await txService.batchTimer.waitForNextCompletion();

  assertEquals(
    await fx.walletService.getBalanceOf(blsWallet.address),
    ethers.BigNumber.from(1001),
  );

  assertEquals(await fx.allTxs(txService), {
    ready: [],
    future: [],
  });
});
