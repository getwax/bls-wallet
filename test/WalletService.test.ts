import { assert } from "./deps.ts";

import WalletService from "../src/app/WalletService.ts";
import Fixture from "./helpers/Fixture.ts";
import dataPayload from "./helpers/dataPayload.ts";
import { TransactionData } from "../src/app/TxService.ts";
import { hubbleBls } from "../deps/index.ts";

Deno.test({
  name: "WalletService gets aggregator balance",
  sanitizeOps: false,
  fn: async () => {
    const walletService = new WalletService();

    assert(
      (await walletService.getAggregatorBalance()).gt(0),
    );
  },
});

Fixture.test("WalletService sends aggregate transaction", async (fx) => {
  const walletService = new WalletService();

  const blsSigner = await fx.createBlsSigner();
  const blsWallet = await fx.createBlsWallet(blsSigner);

  const encodedFunction = walletService.erc20.interface.encodeFunctionData(
    "transfer",
    [blsWallet.address, "1"],
  );

  const tx: TransactionData = {
    pubKey: hubbleBls.mcl.dumpG2(blsSigner.pubkey),
    signature: hubbleBls.mcl.dumpG1(blsSigner.sign(dataPayload(
      fx.chainId,
      0,
      walletService.erc20.address,
      encodedFunction,
    ))),
    contractAddress: walletService.erc20.address,
    methodId: encodedFunction.slice(0, 10),
    encodedParams: `0x${encodedFunction.slice(10)}`,
  };

  await walletService.sendTxs([tx]);
});
