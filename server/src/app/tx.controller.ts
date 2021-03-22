import {Request, Response} from 'express';

import db from './agg.db.js';
import wallet from './wallet.js';

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
        console.log(`ERR adding: ${body}`);
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

  export async function sendTxs(req:Request, res:Response) {
    let txs = await db.getTxs();
    await wallet.sendTxs(txs);
    res.end();

  //   let body = '';
  //   req.on('data', function (data) {
  //     body += data;
  //   });
  //   req.on('end', async function () {
  //     try {
  //       let address = JSON.parse(body);
  //       await wallet.init(address);
  //       // res.writeHead(200, "Sent txs.", {"Content-Type": "text/plain"});
  //     } catch(err){
  //       console.log("ERR");
  //       res.writeHead(500, "Failed to send txs", {"Content-Type": "text/plain"});
  //     }
  //     res.end();
  //  });

    // res.send(`Result: ${req.query.wallet_address}`);
    //if less than 3, send as singles, else
    //TODO: aggregate bls sigs, return: sig, senders, txs, params
  }

}

export default agg;