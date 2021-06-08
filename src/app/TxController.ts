import { RouterContext } from "../../deps/index.ts";

import TxService from "./TxService.ts";
import type { TransactionData } from "./TxService.ts";

import walletService from "./walletService.ts";

export default class TxController {
  constructor(private txService: TxService) {}

  async addTx(context: RouterContext) {
    const txData: TransactionData = await (await context.request.body()).value;
    await this.txService.addTx(txData);

    //TODO: send tx(s) after batch count, or N ms since last send.

    context.response.body = "Transaction added";
  }

  async countPending(context: RouterContext) {
    const c: number = await this.txService.txCount();
    console.log(`Returning count ${c}\n`);
    context.response.headers.set("Content-Type", "application/json");
    context.response.body = c;
  }

  async sendTxs(context: RouterContext) {
    const txs: TransactionData[] = await this.txService.getTxs();
    console.log(`Sending ${txs.length} txs`);
    await walletService.sendTxs(txs);

    context.response.body = "Sent txs";
  }
}
