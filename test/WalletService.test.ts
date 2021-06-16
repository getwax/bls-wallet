import { assert, assertEquals, BigNumber } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("WalletService gets aggregator balance", async (fx) => {
  assert(
    (await fx.walletService.getAggregatorBalance()).gt(0),
  );
});

Fixture.test("WalletService sends aggregate transaction", async (fx) => {
  const blsSigner = await fx.createBlsSigner();
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
