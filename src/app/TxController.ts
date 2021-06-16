import { Application, Router, RouterContext } from "../../deps/index.ts";

import TxService from "./TxService.ts";
import type { TransactionData } from "./TxTable.ts";

export default class TxController {
  constructor(private txService: TxService) {}

  useWith(app: Application) {
    const router = new Router({ prefix: "/tx/" })
      .post("add", this.addTx.bind(this));

    app.use(router.routes());
    app.use(router.allowedMethods());
  }

  async addTx(context: RouterContext) {
    const txData: TransactionData = await (await context.request.body()).value;
    await this.txService.addTx(txData);

    //TODO: send tx(s) after batch count, or N ms since last send.

    context.response.body = "Transaction added";
  }
}
