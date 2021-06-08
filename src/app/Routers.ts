import { Router } from "../../deps/index.ts";

import TxController from "./TxController.ts";
import AdminController from "./AdminController.ts";

export default function Routers({ adminController, txController }: {
  adminController: AdminController;
  txController: TxController;
}) {
  const txRouter = new Router({ prefix: "/tx/" });

  txRouter
    .post("add", txController.addTx.bind(txController))
    .get("count", txController.countPending.bind(txController))
    .get("send-batch", txController.sendTxs.bind(txController));

  const adminRouter = new Router({ prefix: "/adminController/" });

  adminRouter
    .get("resetTxs", adminController.resetTxs.bind(adminController))
    .post(
      "setAddresses",
      adminController.setContractAddresses.bind(adminController),
    );

  return { txRouter, adminRouter };
}
