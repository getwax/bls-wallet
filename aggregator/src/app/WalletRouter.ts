import { Router } from "../../deps.ts";
import nil from "../helpers/nil.ts";
import failRequest from "./helpers/failRequest.ts";
import BundleHandler from "./helpers/BundleHandler.ts";

import WalletService from "./WalletService.ts";

export default function WalletRouter(walletService: WalletService) {
  const router = new Router({ prefix: "/" });

  router.post(
    "wallet",
    BundleHandler(async (ctx, bundle) => {
      const createResult = await walletService.createWallet(bundle);

      if (createResult.address !== nil) {
        ctx.response.body = createResult;
      } else {
        failRequest(ctx, createResult.failures);
      }
    }),
  );

  return router;
}
