import {
  Constraint,
  CreateTableMode,
  DataType,
  QueryClient,
  TableOptions,
} from "../../deps/index.ts";

const PG_HOST = "localhost";
const PG_PORT = 5432;
const PG_USER = "bls";
const PG_PASSWORD = "blstest";
const PG_DB_NAME = "bls_aggregator";

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
  txId: { type: DataType.Serial, constraint: Constraint.PrimaryKey },
  pubKey: { type: DataType.VarChar, length: 66, array: true },
  sender: { type: DataType.VarChar, length: 42 },
  message: { type: DataType.VarChar, length: 66, array: true },
  signature: { type: DataType.VarChar, length: 64 },
  recipient: { type: DataType.VarChar, length: 42 },
  amount: { type: DataType.VarChar, length: 66 },
};

export default class TxService {
  client = new QueryClient({
    hostname: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_DB_NAME,
    tls: {
      enforce: false,
    },
  });

  txTable = this.client.table<TransactionData>(TX_TABLE_NAME);

  constructor() {}

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
