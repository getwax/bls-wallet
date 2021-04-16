import { client } from "./database.ts";
import {
  Constraint,
  CreateTableMode,
  DataType,
  QueryTable,
  TableOptions,
} from "./deps.ts";

export type TransactionData = {
  txId?: number;
  pubKey: string[];
  sender: string;
  message: string[];
  signature: string;
  recipient: string;
  amount: string;
};

const TX_TABLE_NAME = "txs";

const txOptions: TableOptions = {
  txId: { type: DataType.Serial, constrait: Constraint.PrimaryKey },
  pubKey: { type: DataType.VarChar, length: 66, array: true },
  sender: { type: DataType.VarChar, length: 42 },
  message: { type: DataType.VarChar, length: 66, array: true },
  signature: { type: DataType.VarChar, length: 64 },
  recipient: { type: DataType.VarChar, length: 42 },
  amount: { type: DataType.VarChar, length: 66 },
};

class TxService {
  txTable: QueryTable;

  constructor() {
    this.txTable = client.table<TransactionData>(TX_TABLE_NAME);
  }

  async init() {
    await this.txTable.create(txOptions, CreateTableMode.IfNotExists);
  }

  async addTx(txData: TransactionData) {
    await this.txTable.insert(txData);
  }

  async txCount(): Promise<number> {
    const result = await client.query(
      `SELECT COUNT(*) FROM ${this.txTable.name}`,
    );
    return result[0].count as number;
  }

  async getTxs(): Promise<any[]> {
    return await client.query(`SELECT * FROM ${this.txTable.name}`);
  }

  async resetTable() {
    await this.txTable.create(txOptions, CreateTableMode.DropIfExists);
  }
}

export default new TxService();
