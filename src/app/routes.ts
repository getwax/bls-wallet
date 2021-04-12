import { Application, Router } from "./deps.ts";

import txController from "./txController.ts";
import admin from "./adminController.ts";

export const txRouter = new Router();

txRouter.post("/tx/add", txController.addTx);
txRouter.get("/tx/count", txController.countPending);
// txRouter.get('/send-batch', agg.sendTxs);


// export const adminRouter = new Router();

// adminRouter.get('/resetTxs', admin.resetTxs);
// adminRouter.post('/setAddresses', admin.setContractAddresses);
