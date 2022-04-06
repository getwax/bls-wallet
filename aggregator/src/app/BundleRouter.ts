import { Router } from "../../deps.ts";
import failRequest from "./helpers/failRequest.ts";
import BundleHandler from "./helpers/BundleHandler.ts";

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

  return router;
}
