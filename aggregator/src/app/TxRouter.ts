import { Router } from "../../deps.ts";
import failRequest from "./helpers/failRequest.ts";
import TxHandler from "./helpers/TxHandler.ts";

import TxService from "./TxService.ts";

export default function TxRouter(txService: TxService) {
  const router = new Router({ prefix: "/" });

  router.post(
    "transaction",
    TxHandler(async (ctx, tx) => {
      const failures = await txService.add(tx);

      if (failures.length > 0) {
        return failRequest(ctx, failures);
      }

      ctx.response.body = { failures: [] };
    }),
  );

  return router;
}
