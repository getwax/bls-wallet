import { client, txTable, TransactionData } from "./database.ts";

export type { TransactionData } from "./database.ts";

import wallet from "./wallet.ts";

class TxService {
  // async addTx() {}
  async addTx(txData: TransactionData) {
      await txTable.insert(txData);
  }

  async txCount(): Promise<number> {
    return (await client.query(`SELECT * FROM ${txTable.name}`)).length;
  }
}

export default new TxService();
