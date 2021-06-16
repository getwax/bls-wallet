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
  pubKey: string;
  signature: string;
  contractAddress: string;
  methodId: string;
  encodedParams: string;
};

const txOptions: TableOptions = {
  txId: { type: DataType.Serial, constraint: Constraint.PrimaryKey },
  pubKey: { type: DataType.VarChar, length: 66 },
  signature: { type: DataType.VarChar, length: 64 },
  contractAddress: { type: DataType.VarChar, length: 42 },
  methodId: { type: DataType.VarChar, length: 10 },
  encodedParams: { type: DataType.VarChar },
};

export default class TxTable {
  client: QueryClient;
  txTable: QueryTable<TransactionData>;

  private constructor(txTableName: string) {
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

  static async create(txTableName: string): Promise<TxTable> {
    const txTable = new TxTable(txTableName);
    await txTable.txTable.create(txOptions, CreateTableMode.IfNotExists);

    return txTable;
  }

  async addTx(txData: TransactionData) {
    await this.txTable.insert(txData);
  }

  async txCount(): Promise<bigint> {
    const result = await this.client.query(
      `SELECT COUNT(*) FROM ${this.txTable.name}`,
    );
    return result[0].count as bigint;
  }

  async getTxs(): Promise<TransactionData[]> {
    return await this.client.query(`SELECT * FROM ${this.txTable.name}`);
  }

  async resetTable() {
    await this.txTable.create(txOptions, CreateTableMode.DropIfExists);
  }

  async stop() {
    await this.client.disconnect();
  }
}
