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
    async (ctx) => {
      const pendingBundle = await bundleService.lookupBundle(ctx.params.hash!);
      if (pendingBundle) {
        ctx.response.status = 202;
        ctx.response.body = {
          status: "pending",
          submitError: pendingBundle.submitError,
          receipt: null,
        };
        return;
      }

      const receipt = await bundleService.lookupReceipt(ctx.params.hash!);

      if (receipt === nil) {
        ctx.response.status = 404;
        return;
      }

      ctx.response.body = {
        status: "done",
        submitError: null,
        receipt
      };
    },
  );

  return router;
}
