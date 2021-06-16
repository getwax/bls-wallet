import TxTable, { TransactionData } from "./TxTable.ts";

export default class TxService {
  constructor(public store: TxTable) {}

  async addTx(txData: TransactionData) {
    // TODO: Check valid
    await this.store.addTx(txData);
  }
}
