import { client, txTable, TransactionData } from "./database.ts";

export type { TransactionData } from "./database.ts";

class TxService {

  async addTx(txData: TransactionData) {
      await txTable.insert(txData);
  }

  async txCount(): Promise<number> {
    const result = await client.query(`SELECT COUNT(*) FROM ${txTable.name}`);
    return result[0].count as number;
  }

  async getTxs(): Promise<any[]> {
    return await client.query(`SELECT * FROM ${txTable.name}`);
  }

  async resetTable() {
    await txTable.delete();
  }
}

export default new TxService();
