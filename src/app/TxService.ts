import TxTable, { TransactionData } from "./TxTable.ts";

export default class TxService {
  constructor(public store: TxTable) {}

  async add(txData: TransactionData) {
    // TODO: Check valid
    await this.store.add(txData);
  }
}
