import { HTTPStatus, Router } from "../../deps/index.ts";

import TxService from "./TxService.ts";
import type { TransactionData } from "./TxTable.ts";

export default function TxRouter(txService: TxService) {
  const router = new Router({ prefix: "/" });

  router.post("transaction", async (ctx) => {
    const txData: TransactionData = await (await ctx.request.body()).value;
    const failures = await txService.add(txData);

    if (failures.length > 0) {
      ctx.response.status = HTTPStatus.BadRequest;
    }

    ctx.response.body = { failures };
  });

  return router;
}
