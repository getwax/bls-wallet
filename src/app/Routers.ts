import { Router } from "../../deps/index.ts";

import TxController from "./TxController.ts";
import admin from "./adminController.ts";

export default function Routers(txController: TxController) {
  const txRouter = new Router({ prefix: "/tx/" });

  txRouter
    .post("add", txController.addTx.bind(txController))
    .get("count", txController.countPending.bind(txController))
    .get("send-batch", txController.sendTxs.bind(txController));

  const adminRouter = new Router({ prefix: "/admin/" });

  adminRouter
    .get("resetTxs", admin.resetTxs.bind(admin))
    .post("setAddresses", admin.setContractAddresses.bind(admin));

  return { txRouter, adminRouter };
}
