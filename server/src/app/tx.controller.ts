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
        res.writeHead(200, "Added tx.", {"Content-Type": "text/plain"});
      } catch(err){
        console.log("ERR");
        res.writeHead(500, "Failed to add tx", {"Content-Type": "text/plain"});
      }
      res.end();
   });

    //TODO: send tx(s) after batch count, or N ms since last send.
  }

  export async function countPending(req:Request, res: Response) {
    let c: number = await db.txCount();
    console.log(`Returning count ${c}\n`);
    res.send(c);
    res.end();
  }

  export function sendTxs(req:Request, res:Response) {
    res.send(`Result: ${req.query.wallet_address}`);
    //if less than 3, send as singles, else
    //TODO: aggregate bls sigs, return: sig, senders, txs, params
  }

  export async function reset(req:Request, res:Response) {
    await db.resetTable();
    res.end();
  }
}

export default agg;