import TxTable from "./TxTable.ts";
import WalletService from "./WalletService.ts";

export default class AdminService {
  constructor(
    private walletService: WalletService,
    private txTable: TxTable,
  ) {}

  async resetTxs() {
    await this.txTable.resetTable();
  }

  async sendBatch() {
    const txs = await this.txTable.getTxs();
    console.log(`Sending ${txs.length} txs`);
    await this.walletService.sendTxs(txs);
  }

  async getAggregatorBalance() {
    return await this.walletService.getAggregatorBalance();
  }

  async txCount() {
    return await this.txTable.txCount();
  }
}
