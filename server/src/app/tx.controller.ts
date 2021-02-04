import { aggregate } from "../lib/hubble-contracts/ts/blsSigner";
import {Request, Response} from 'express';

import db from './agg.db';
import wallet from './wallet';

namespace agg {

  export function addTx(req:Request, res:Response) {
    let body = '';
    req.on('data', function (data) {
      body += data;
    });
    req.on('end', function () {
      try {
        db.addTx(JSON.parse(body));
        res.writeHead(200, {"Content-Type": "text/plain"});
        res.write("Added tx.\n"); //TODO: receipt
        res.end();
        return;
      }catch (err){
        console.log("ERR");
        res.writeHead(500, {"Content-Type": "text/plain"});
        res.write("Failed to add tx\n");
        res.end();
        return;
      }
    });

    //TODO: send tx(s) after batch count, or N ms since last send.
  }

  export function sendTxs(req:Request, res:Response) {
    res.send(`Result: ${req.query.wallet_address}`);
    //if less than 3, send as singles, else
    //TODO: aggregate bls sigs, return: sig, senders, txs, params
  }
}

export default agg;