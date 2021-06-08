import { Application, Router, RouterContext } from "../../deps/index.ts";

import AdminService from "./AdminService.ts";

export default class AdminController {
  constructor(private adminService: AdminService) {}

  useWith(app: Application) {
    const router = new Router({ prefix: "/admin/" })
      .get("resetTxs", this.resetTxs.bind(this))
      .post("setAddresses", this.setContractAddresses.bind(this))
      .get("sendBatch", this.sendBatch.bind(this));

    app.use(router.routes());
    app.use(router.allowedMethods());
  }

  async setContractAddresses(context: RouterContext) {
    const addresses: { tokenAddress: string; blsWalletAddress: string } =
      await (await context.request.body()).value;
    this.adminService.setContractAddresses(addresses);

    //TODO: send tx(s) after batch count, or N ms since last send.

    context.response.body = "Contract addresses set";
  }

  async resetTxs(context: RouterContext) {
    await this.adminService.resetTxs();
    context.response.body = "Transactions reset";
  }

  async sendBatch(context: RouterContext) {
    await this.adminService.sendBatch();
    context.response.body = "Sent batch of transactions";
  }
}
