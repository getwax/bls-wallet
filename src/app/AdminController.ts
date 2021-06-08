import { RouterContext } from "../../deps/index.ts";

import TxService from "./TxService.ts";

import walletService from "./walletService.ts";

export default class AdminController {
  constructor(
    private txService: TxService,
  ) {}

  async setContractAddresses(context: RouterContext) {
    const addresses: { tokenAddress: string; blsWalletAddress: string } =
      await (await context.request.body()).value;
    walletService.setContractAddresses(addresses);

    //TODO: send tx(s) after batch count, or N ms since last send.

    context.response.body = "Contract addresses set";
  }

  async resetTxs(context: RouterContext) {
    await this.txService.resetTable();
    context.response.body = "Transactions reset";
  }
}
