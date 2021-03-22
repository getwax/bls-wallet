import { Router } from 'express';
import agg from "./tx.controller.js";
import admin from "./admin.controller.js";
import { ADDRGETNETWORKPARAMS } from 'node:dns';


export const txRouter = Router();

txRouter.post('/add', agg.addTx);
txRouter.get('/count', agg.countPending);
txRouter.get('/send-batch', agg.sendTxs);


export const adminRouter = Router();

adminRouter.get('/resetTxs', admin.resetTxs);
adminRouter.post('/setAddresses', admin.setContractAddresses);
