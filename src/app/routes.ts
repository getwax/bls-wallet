import { Application, Router } from "./deps.ts";

import txController from "./txController.ts";
import admin from "./adminController.ts";

export const txRouter = new Router({prefix: "/tx/"});

txRouter.post("add", txController.addTx);
txRouter.get("count", txController.countPending);
txRouter.get("send-batch", txController.sendTxs);

export const adminRouter = new Router({prefix: "/admin/"});

adminRouter.get('/resetTxs', admin.resetTxs);
adminRouter.post('/setAddresses', admin.setContractAddresses);
