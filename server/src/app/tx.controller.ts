import { aggregate } from "../lib/hubble-contracts/ts/blsSigner";
import {Request, Response} from 'express';

import db from './agg.db';
import wallet from './wallet';

namespace agg {

  export function addTx(req:Request, res:Response) {
    res.send(`Adding ${req}`);
    console.log(req);
    // Store signed tx and bls sig  //TODO: incremental aggregation?
    db.addTx();
    //TODO: send tx(s) after batch count, or N ms since last send.
  }

  export function sendTxs(req:Request, res:Response) {
    res.send(`Result: ${req.query.wallet_address}`);
    //if less than 3, send as singles, else
    //TODO: aggregate bls sigs, return: sig, senders, txs, params
  }
}

export default agg;