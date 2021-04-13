import { RouterContext } from "./deps.ts";

import txService from './txService.ts';

import walletService from './walletService.ts';

class TxController {

  async setContractAddresses(context: RouterContext) {
    const addresses: {tokenAddress: string, blsWalletAddress: string} = await (await context.request.body()).value;
    walletService.setContractAddresses(addresses);

    //TODO: send tx(s) after batch count, or N ms since last send.
  }

  async resetTxs(context: RouterContext) {
    console.log("resetting transactions");
    await txService.resetTable();
  }

}

export default new TxController();
