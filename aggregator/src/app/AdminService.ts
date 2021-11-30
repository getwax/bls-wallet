import TxTable from "./TxTable.ts";
import EthereumService from "./EthereumService.ts";

export default class AdminService {
  constructor(
    private ethereumService: EthereumService,
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
    await this.ethereumService.sendTxs(txs);
  }

  async txCount() {
    return await this.readyTxTable.count();
  }
}
