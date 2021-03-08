import { Router } from 'express';
import agg from "./tx.controller";

const txRouter = Router();

txRouter.get('/reset', agg.reset);
txRouter.post('/add', agg.addTx);
txRouter.get('/count', agg.countPending);

txRouter.get('/send-batch', agg.sendTxs);

export default txRouter;
