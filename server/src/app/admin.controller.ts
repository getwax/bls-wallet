import { aggregate } from "../lib/hubble-contracts/ts/blsSigner";
import {Request, Response} from 'express';

import db from './agg.db.js';
import wallet from './wallet.js';

namespace admin {

  export function setContractAddresses(req:Request, res:Response) {
    let body = '';
    req.on('data', function (data) {
      body += data;
    });
    req.on('end', function () {
      try {
        let responseJson = JSON.parse(body);
        let tokenAddress = responseJson.tokenAddress;
        let blsWalletAddress = responseJson.blsWalletAddress;
        wallet.setContractAddresses(tokenAddress, blsWalletAddress);
        res.writeHead(200, "Set addresses.", {"Content-Type": "text/plain"});
      } catch(err){
        console.log("ERR");
        res.writeHead(500, "Failed to set addresses", {"Content-Type": "text/plain"});
      }
      res.end();
   });

    //TODO: send tx(s) after batch count, or N ms since last send.
  }

  export async function resetTxs(req:Request, res:Response) {
    console.log("resetting transactions");
    await db.resetTable();
    res.end();
  }
}

export default admin;