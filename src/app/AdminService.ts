import TxService from "./TxService.ts";
import WalletService from "./WalletService.ts";

export default class AdminService {
  constructor(
    private walletService: WalletService,
    private txService: TxService,
  ) {}

  async resetTxs() {
    await this.txService.resetTable();
  }

  async sendBatch() {
    const txs = await this.txService.getTxs();
    console.log(`Sending ${txs.length} txs`);
    await this.walletService.sendTxs(txs);
  }

  async getAggregatorBalance() {
    return await this.walletService.getAggregatorBalance();
  }
}
