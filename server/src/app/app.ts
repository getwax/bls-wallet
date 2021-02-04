import express from 'express';
import { AddressInfo } from 'net';
import path from 'path';

import mysql from 'mysql';
import db from './agg.db';

let con = mysql.createConnection({
  host: "localhost",
  user: "username",
  password: "password"
});
con.connect(function(err) {
  if (err) throw err;
  db.init(con);
});

const app = express();

app.get('/', (req, res) => {
  res.send('Post txs to /tx/add.');
  console.log("get /");
});

import txRouter from './routes';
const routes = express.Router();
routes.use('/tx', txRouter);
app.use(routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  return console.log(`Listening on ${PORT}`);
});
