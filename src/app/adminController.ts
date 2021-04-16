import { RouterContext } from "./deps.ts";

import txService from "./txService.ts";

import walletService from "./walletService.ts";

class TxController {
  async setContractAddresses(context: RouterContext) {
    const addresses: { tokenAddress: string; blsWalletAddress: string } =
      await (await context.request.body()).value;
    walletService.setContractAddresses(addresses);

    //TODO: send tx(s) after batch count, or N ms since last send.

    context.response.body = "Contract addresses set";
  }

  async resetTxs(context: RouterContext) {
    await txService.resetTable();
    context.response.body = "Transactions reset";
  }
}

export default new TxController();
