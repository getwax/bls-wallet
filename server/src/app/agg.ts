import express from 'express';
import { AddressInfo } from 'net';
import path from 'path';

import mysql from 'mysql';


var con = mysql.createConnection({
  host: "localhost",
  user: "username",
  password: "password",
});

con.connect(function(err) {
  if (err) throw err;
  con.query("CREATE DATABASE IF NOT EXISTS bls_aggregator", function (err, result) {
    if (err) throw err;
  });
  con.query("USE bls_aggregator", function (err, result) {
    if (err) throw err;
  });
  con.query("DROP TABLE IF EXISTS txs", function(err, result) {
    if (err) throw err;
  });
  con.query("CREATE TABLE IF NOT EXISTS txs( \
    tx_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, \
    bls_pub_0 INT, \
    bls_pub_1 INT, \
    bls_pub_2 INT, \
    bls_pub_3 INT, \
    message_0 BINARY(32), \
    message_1 BINARY(32), \
    signature INT UNSIGNED, \
    recipient BINARY(20), \
    amount BINARY(32) \
    );", function(err, result) {
      if (err) throw err;
  });
});

const server = express();

const port = 3000;
server.listen(port, () => {
  return console.log(`Listening on ${port}`);
});

server.get('/', (req, res) => {
  res.send('Post txs to /addTx. Request txs from /latestTxs');
});

server.post('/addTx', (req, res) => {
  res.send(`Adding ${req}`);
  //TODO: store signed tx and bls sig. (incremental aggregation?)

  //TODO: send tx(s) after batch count, or N ms since last send.
});


server.get('/latestTxs', (req, res) => {
  res.send(`Result: ${req}`);
  sendTxs();
});

function sendTxs() {
  //if less than 3, send as singles, else
  //TODO: aggregate bls sigs, return: sig, senders, txs, params
}
