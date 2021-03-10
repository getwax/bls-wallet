import express from 'express';
import { AddressInfo } from 'net';
import path from 'path';

import db from './agg.db.js';
import wallet from './wallet.js';

db.init();
wallet.init('0x1234');

const app = express();

app.get('/', (req, res) => {
  res.send('Post txs to /tx/add.');
  console.log("get /");
});

import txRouter from './routes.js';
const routes = express.Router();
routes.use('/tx', txRouter);
app.use(routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  return console.log(`Listening on ${PORT}`);
});
