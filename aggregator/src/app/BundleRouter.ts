import { Router } from "../../deps.ts";
import failRequest from "./helpers/failRequest.ts";
import BundleHandler from "./helpers/BundleHandler.ts";
import nil from "../helpers/nil.ts";

import BundleService from "./BundleService.ts";

export default function BundleRouter(bundleService: BundleService) {
  const router = new Router({ prefix: "/" });

  router.post(
    "bundle",
    BundleHandler(async (ctx, bun) => {
      const result = await bundleService.add(bun);

      if ("failures" in result) {
        return failRequest(ctx, result.failures);
      }

      ctx.response.body = result;
    }),
  );

  router.get(
    "bundleReceipt/:hash",
    (ctx) => {
      const bundleRow = bundleService.lookupBundle(ctx.params.hash!);

      if (bundleRow?.receipt === nil) {
        ctx.response.status = 404;

        ctx.response.body = {
          submitError: bundleRow?.submitError,
        };

        return;
      }

      ctx.response.body = bundleService.receiptFromBundle(bundleRow);
    },
  );

  return router;
}
