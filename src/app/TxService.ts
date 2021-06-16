import TxStore, { TransactionData } from "./TxStore.ts";

export default class TxService {
  constructor(public store: TxStore) {}

  async addTx(txData: TransactionData) {
    await this.store.addTx(txData);
  }

  async txCount(): Promise<bigint> {
    return await this.store.txCount();
  }

  async getTxs(): Promise<TransactionData[]> {
    return await this.store.getTxs();
  }

  async resetTable() {
    return await this.store.resetTable();
  }
}
