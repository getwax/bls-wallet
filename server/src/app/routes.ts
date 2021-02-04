import { Router } from 'express';

const txRouter = Router();

import agg from "./tx.controller";

txRouter.post('/add', agg.addTx);

txRouter.get('/send-batch', agg.sendTxs);

export default txRouter;
