import { Router } from "../../deps.ts";
import failRequest from "./helpers/failRequest.ts";
import BundleHandler from "./helpers/BundleHandler.ts";

import WalletService from "./WalletService.ts";

export default function WalletRouter(walletService: WalletService) {
  const router = new Router({ prefix: "/" });

  router.post(
    "wallet",
    BundleHandler(async (ctx, bundle) => {
      const { wallet, failures } = await walletService.createWallet(bundle);
      if (failures.length) {
        failRequest(ctx, failures);
        return;
      }

      ctx.response.body = wallet;
    }),
  );

  return router;
}
