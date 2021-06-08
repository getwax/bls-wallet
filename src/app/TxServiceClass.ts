import {
  Constraint,
  CreateTableMode,
  DataType,
  QueryClient,
  QueryTable,
  TableOptions,
} from "../../deps/index.ts";

import * as env from "./env.ts";

export type TransactionData = {
  txId?: number;
  pubKey: string[];
  sender: string;
  message: string[];
  signature: string;
  recipient: string;
  amount: string;
};

const txOptions: TableOptions = {
  txId: { type: DataType.Serial, constraint: Constraint.PrimaryKey },
  pubKey: { type: DataType.VarChar, length: 66, array: true },
  sender: { type: DataType.VarChar, length: 42 },
  message: { type: DataType.VarChar, length: 66, array: true },
  signature: { type: DataType.VarChar, length: 64 },
  recipient: { type: DataType.VarChar, length: 42 },
  amount: { type: DataType.VarChar, length: 66 },
};

export default class TxService {
  client: QueryClient;
  txTable: QueryTable<TransactionData>;

  constructor(txTableName: string) {
    this.client = new QueryClient({
      hostname: env.PG.HOST,
      port: env.PG.PORT,
      user: env.PG.USER,
      password: env.PG.PASSWORD,
      database: env.PG.DB_NAME,
      tls: {
        enforce: false,
      },
    });

    this.txTable = this.client.table<TransactionData>(txTableName);
  }

  async init() {
    await this.txTable.create(txOptions, CreateTableMode.IfNotExists);
  }

  async addTx(txData: TransactionData) {
    await this.txTable.insert(txData);
  }

  async txCount(): Promise<number> {
    const result = await this.client.query(
      `SELECT COUNT(*) FROM ${this.txTable.name}`,
    );
    return result[0].count as number;
  }

  async getTxs(): Promise<any[]> {
    return await this.client.query(`SELECT * FROM ${this.txTable.name}`);
  }

  async resetTable() {
    await this.txTable.create(txOptions, CreateTableMode.DropIfExists);
  }
}
