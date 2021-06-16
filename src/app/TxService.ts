import TxStore, { TransactionData } from "./TxStore.ts";

export default class TxService {
  constructor(public store: TxStore) {}

  async addTx(txData: TransactionData) {
    // TODO: Check valid
    await this.store.addTx(txData);
  }
}
