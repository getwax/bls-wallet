import { RouterContext } from "./deps.ts";

import txService from './txService.ts';
import type { TransactionData } from './txService.ts'

// import wallet from './wallet.ts';

class TxController {

async addTx(context: RouterContext) {
  const txData: TransactionData = await (await context.request.body()).value;
  await txService.addTx(txData);

//   //TODO: send tx(s) after batch count, or N ms since last send.
}

  async countPending(context: RouterContext) {
    const c: number = await txService.txCount();
    console.log(`Returning count ${c}\n`);
    context.response.headers.set("Content-Type", "application/json");
    context.response.body = c;
  }

// export async function sendTxs(req:Request, res:Response) {
//   let txs = await db.getTxs();
//   await wallet.sendTxs(txs);
//   res.end();
// }
}

export default new TxController();
