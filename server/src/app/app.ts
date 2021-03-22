import express from 'express';
import { AddressInfo } from 'net';
import path from 'path';

import db from './agg.db.js';
import wallet from './wallet.js';

db.init();

const erc20_address = "0x6F714e7b5a7F0913038664d932e8acd6fDf1Ad55";
const blsWallet_address = "0xbCb5DDb58A2466e528047703233aCd0D29d36937";

wallet.init(blsWallet_address);

const app = express();

app.get('/', (req, res) => {
  res.send('Post txs to /tx/add.');
  console.log("get /");
});

import { txRouter } from './routes.js';
const routes = express.Router();
routes.use('/tx', txRouter);

import { adminRouter } from './routes.js';
routes.use('/admin', adminRouter);

app.use(routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  return console.log(`Listening on ${PORT}`);
});
