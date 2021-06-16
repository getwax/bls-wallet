import TxStore from "./TxStore.ts";
import WalletService from "./WalletService.ts";

export default class AdminService {
  constructor(
    private walletService: WalletService,
    private txStore: TxStore,
  ) {}

  async resetTxs() {
    await this.txStore.resetTable();
  }

  async sendBatch() {
    const txs = await this.txStore.getTxs();
    console.log(`Sending ${txs.length} txs`);
    await this.walletService.sendTxs(txs);
  }

  async getAggregatorBalance() {
    return await this.walletService.getAggregatorBalance();
  }

  async txCount() {
    return await this.txStore.txCount();
  }
}
