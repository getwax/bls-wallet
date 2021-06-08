import { Application, Router, RouterContext } from "../../deps/index.ts";

import TxService from "./TxService.ts";
import WalletService from "./WalletService.ts";

export default class AdminController {
  constructor(
    private walletService: WalletService,
    private txService: TxService,
  ) {}

  useWith(app: Application) {
    const router = new Router({ prefix: "/adminController/" })
      .get("resetTxs", this.resetTxs.bind(this))
      .post("setAddresses", this.setContractAddresses.bind(this));

    app.use(router.routes());
    app.use(router.allowedMethods());
  }

  async setContractAddresses(context: RouterContext) {
    const addresses: { tokenAddress: string; blsWalletAddress: string } =
      await (await context.request.body()).value;
    this.walletService.setContractAddresses(addresses);

    //TODO: send tx(s) after batch count, or N ms since last send.

    context.response.body = "Contract addresses set";
  }

  async resetTxs(context: RouterContext) {
    await this.txService.resetTable();
    context.response.body = "Transactions reset";
  }
}
