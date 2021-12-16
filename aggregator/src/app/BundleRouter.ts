import { Router } from "../../deps.ts";
import failRequest from "./helpers/failRequest.ts";
import BundleHandler from "./helpers/BundleHandler.ts";

import BundleService from "./BundleService.ts";

export default function BundleRouter(bundleService: BundleService) {
  const router = new Router({ prefix: "/" });

  router.post(
    "bundle",
    BundleHandler(async (ctx, bun) => {
      const failures = await bundleService.add(bun);

      if (failures.length > 0) {
        return failRequest(ctx, failures);
      }

      ctx.response.body = { failures: [] };
    }),
  );

  return router;
}
