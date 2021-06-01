import { Application, Router } from "../../deps/index.ts";

import txController from "./txController.ts";
import admin from "./adminController.ts";

export const txRouter = new Router({ prefix: "/tx/" });

txRouter
  .post("add", txController.addTx)
  .get("count", txController.countPending)
  .get("send-batch", txController.sendTxs);

export const adminRouter = new Router({ prefix: "/admin/" });

adminRouter
  .get("resetTxs", admin.resetTxs)
  .post("setAddresses", admin.setContractAddresses);
