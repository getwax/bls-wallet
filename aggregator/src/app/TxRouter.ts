import { Router } from "../../deps.ts";
import failRequest from "./helpers/failRequest.ts";
import TxHandler from "./helpers/TxHandler.ts";

import BundleService from "./BundleService.ts";

export default function TxRouter(bundleService: BundleService) {
  const router = new Router({ prefix: "/" });

  router.post(
    "transaction",
    TxHandler(async (ctx, tx) => {
      const failures = await bundleService.add(tx);

      if (failures.length > 0) {
        return failRequest(ctx, failures);
      }

      ctx.response.body = { failures: [] };
    }),
  );

  return router;
}
