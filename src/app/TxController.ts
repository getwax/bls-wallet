import { Application, Router, RouterContext } from "../../deps/index.ts";

import TxService from "./TxService.ts";
import type { TransactionData } from "./TxService.ts";
import WalletService from "./WalletService.ts";

export default class TxController {
  constructor(
    private walletService: WalletService,
    private txService: TxService,
  ) {}

  useWith(app: Application) {
    const router = new Router({ prefix: "/tx/" })
      .post("add", this.addTx.bind(this))
      .get("count", this.countPending.bind(this))
      .get("send-batch", this.sendTxs.bind(this));

    app.use(router.routes());
    app.use(router.allowedMethods());
  }

  async addTx(context: RouterContext) {
    const txData: TransactionData = await (await context.request.body()).value;
    await this.txService.addTx(txData);

    //TODO: send tx(s) after batch count, or N ms since last send.

    context.response.body = "Transaction added";
  }

  async countPending(context: RouterContext) {
    const c = await this.txService.txCount();
    console.log(`Returning count ${c}\n`);
    context.response.headers.set("Content-Type", "application/json");
    context.response.body = c;
  }

  async sendTxs(context: RouterContext) {
    const txs: TransactionData[] = await this.txService.getTxs();
    console.log(`Sending ${txs.length} txs`);
    await this.walletService.sendTxs(txs);

    context.response.body = "Sent txs";
  }
}
