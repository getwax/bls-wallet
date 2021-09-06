import { Router } from "../../deps.ts";
import failRequest from "./helpers/failRequest.ts";
import TxHandler from "./helpers/TxHandler.ts";

import WalletService from "./WalletService.ts";

export default function WalletRouter(walletService: WalletService) {
  const router = new Router({ prefix: "/" });

  router.post(
    "wallet",
    TxHandler(async (ctx, tx) => {
      const createResult = await walletService.createWallet(tx);

      if (typeof createResult === "string") {
        ctx.response.body = { address: createResult };
      } else {
        failRequest(ctx, createResult.failures);
      }
    }),
  );

  return router;
}
