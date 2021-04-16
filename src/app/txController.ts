import { RouterContext } from "./deps.ts";

import txService from "./txService.ts";
import type { TransactionData } from "./txService.ts";

import walletService from "./walletService.ts";

class TxController {
  async addTx(context: RouterContext) {
    const txData: TransactionData = await (await context.request.body()).value;
    await txService.addTx(txData);

    //TODO: send tx(s) after batch count, or N ms since last send.

    context.response.body = "Transaction added";
  }

  async countPending(context: RouterContext) {
    const c: number = await txService.txCount();
    console.log(`Returning count ${c}\n`);
    context.response.headers.set("Content-Type", "application/json");
    context.response.body = c;
  }

  async sendTxs(context: RouterContext) {
    const txs: TransactionData[] = await txService.getTxs();
    console.log(`Sending ${txs.length} txs`);
    await walletService.sendTxs(txs);

    context.response.body = "Sent txs";
  }
}

export default new TxController();
