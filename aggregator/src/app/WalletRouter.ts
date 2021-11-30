import { Router } from "../../deps.ts";
import nil from "../helpers/nil.ts";
import failRequest from "./helpers/failRequest.ts";
import TxHandler from "./helpers/TxHandler.ts";

import EthereumService from "./EthereumService.ts";

export default function WalletRouter(ethereumService: EthereumService) {
  const router = new Router({ prefix: "/" });

  router.post(
    "wallet",
    TxHandler(async (ctx, tx) => {
      const createResult = await ethereumService.createWallet(tx);

      if (createResult.address !== nil) {
        ctx.response.body = createResult;
      } else {
        failRequest(ctx, createResult.failures);
      }
    }),
  );

  return router;
}
