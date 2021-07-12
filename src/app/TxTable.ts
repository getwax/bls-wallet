import {
  Constraint,
  CreateTableMode,
  DataType,
  OrderByType,
  QueryClient,
  QueryTable,
  TableOptions,
} from "../../deps/index.ts";

export type TransactionData = {
  txId?: number;
  pubKey: string;
  nonce: number;
  signature: string;
  contractAddress: string;
  methodId: string;
  encodedParams: string;
};

const txOptions: TableOptions = {
  txId: { type: DataType.Serial, constraint: Constraint.PrimaryKey },
  pubKey: { type: DataType.VarChar, length: 258 },
  nonce: { type: DataType.Integer },
  signature: { type: DataType.VarChar, length: 130 },
  contractAddress: { type: DataType.VarChar, length: 42 },
  methodId: { type: DataType.VarChar, length: 10 },
  encodedParams: { type: DataType.VarChar },
};

export default class TxTable {
  txTable: QueryTable<TransactionData>;

  private constructor(public queryClient: QueryClient, txTableName: string) {
    this.txTable = this.queryClient.table<TransactionData>(txTableName);
  }

  static async create(
    queryClient: QueryClient,
    txTableName: string,
  ): Promise<TxTable> {
    const txTable = new TxTable(queryClient, txTableName);
    await txTable.txTable.create(txOptions, CreateTableMode.IfNotExists);

    return txTable;
  }

  async add(txData: TransactionData) {
    await this.txTable.insert(txData);
  }

  async count(): Promise<bigint> {
    const result = await this.queryClient.query(
      `SELECT COUNT(*) FROM ${this.txTable.name}`,
    );
    return result[0].count as bigint;
  }

  async all(): Promise<TransactionData[]> {
    return await this.queryClient.query(`SELECT * FROM ${this.txTable.name}`);
  }

  async drop() {
    await this.txTable.create(txOptions, CreateTableMode.DropIfExists);
  }

  async nextNonceOf(pubKey: string): Promise<number | null> {
    const { sql } = this.txTable
      .where({ pubKey })
      .order({
        column: "nonce",
        type: OrderByType.Descending,
      })
      .limit(1)
      .make();

    const results = await this.queryClient.query(sql);

    if (results.length === 0) {
      return null;
    }

    return (results[0].nonce as number) + 1;
  }

  async clear() {
    return await this.queryClient.query(`DELETE from ${this.txTable.name}`);
  }
}
