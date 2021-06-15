import { assert } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("WalletService gets aggregator balance", async (fx) => {
  assert(
    (await fx.walletService.getAggregatorBalance()).gt(0),
  );
});

Fixture.test("WalletService sends aggregate transaction", async (fx) => {
  const blsSigner = await fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  const tx1 = await fx.createTransferTxData(blsSigner, 0, blsWallet.address, 0);
  const tx2 = await fx.createTransferTxData(blsSigner, 0, blsWallet.address, 1);

  await fx.walletService.sendTxs([tx1, tx2]);
});
