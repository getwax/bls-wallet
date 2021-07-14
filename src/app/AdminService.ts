import TxTable from "./TxTable.ts";
import WalletService from "./WalletService.ts";

export default class AdminService {
  constructor(
    private walletService: WalletService,
    private readyTxTable: TxTable,
    private futureTxTable: TxTable,
  ) {}

  async resetTxs() {
    await this.futureTxTable.clear();
    await this.readyTxTable.clear();
  }

  async sendBatch() {
    const txs = await this.readyTxTable.all();
    console.log(`Sending ${txs.length} txs`);
    await this.walletService.sendTxs(txs);
  }

  async getAggregatorBalance() {
    return await this.walletService.getAggregatorBalance();
  }

  async txCount() {
    return await this.readyTxTable.count();
  }
}
