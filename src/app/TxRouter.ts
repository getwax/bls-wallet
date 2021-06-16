import { Router } from "../../deps/index.ts";

import TxService from "./TxService.ts";
import type { TransactionData } from "./TxTable.ts";

export default function TxRouter(txService: TxService) {
  const router = new Router({ prefix: "/" });

  router.post("transaction", async (ctx) => {
    const txData: TransactionData = await (await ctx.request.body()).value;
    await txService.add(txData);

    //TODO: send tx(s) after batch count, or N ms since last send.

    ctx.response.body = "Transaction added";
  });

  return router;
}
