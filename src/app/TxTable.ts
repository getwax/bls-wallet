import {
  Constraint,
  CreateTableMode,
  DataType,
  OrderByType,
  QueryClient,
  QueryTable,
  TableOptions,
  unsketchify,
} from "../../deps/index.ts";

import assertExists from "../helpers/assertExists.ts";

export type TransactionData = {
  txId?: number;
  pubKey: string;
  nonce: number;
  signature: string;
  tokenRewardAmount: string;
  contractAddress: string;
  methodId: string;
  encodedParams: string;
};

const txOptions: TableOptions = {
  txId: { type: DataType.Serial, constraint: Constraint.PrimaryKey },
  pubKey: { type: DataType.VarChar, length: 258 },
  nonce: { type: DataType.Integer },
  signature: { type: DataType.VarChar, length: 130 },
  tokenRewardAmount: { type: DataType.VarChar, length: 66 },
  contractAddress: { type: DataType.VarChar, length: 42 },
  methodId: { type: DataType.VarChar, length: 10 },
  encodedParams: { type: DataType.VarChar },
};

export default class TxTable {
  txTable: QueryTable<TransactionData>;
  safeName: string;

  private constructor(public queryClient: QueryClient, txTableName: string) {
    this.txTable = this.queryClient.table<TransactionData>(txTableName);
    this.safeName = unsketchify(this.txTable.name);
  }

  static async create(
    queryClient: QueryClient,
    txTableName: string,
  ): Promise<TxTable> {
    const txTable = new TxTable(queryClient, txTableName);
    await txTable.txTable.create(txOptions, CreateTableMode.IfNotExists);

    return txTable;
  }

  async add(...txs: TransactionData[]) {
    await this.txTable.insert(...txs);
  }

  async remove(...txs: TransactionData[]) {
    await Promise.all(txs.map((tx) =>
      this.txTable
        .where({ txId: assertExists(tx.txId) })
        .delete()
    ));
  }

  async count(): Promise<bigint> {
    const result = await this.queryClient.query(
      `SELECT COUNT(*) FROM ${this.txTable.name}`,
    );
    return result[0].count as bigint;
  }

  async getHighestPriority(limit: number): Promise<TransactionData[]> {
    const rows = await this.txTable
      .where()
      .order({
        column: "txId",
        type: OrderByType.Ascending,
      })
      .limit(limit)
      .select();

    return rows;
  }

  async pubKeyTxsInNonceOrder(
    pubKey: string,
    limit: number,
  ): Promise<TransactionData[]> {
    return await this.txTable
      .where({ pubKey })
      .order({
        column: "nonce",
        type: OrderByType.Ascending,
      })
      .limit(limit)
      .select();
  }

  async all(): Promise<TransactionData[]> {
    return await this.queryClient.query(`SELECT * FROM ${this.txTable.name}`);
  }

  async find(pubKey: string, nonce: number): Promise<TransactionData | null> {
    const rows = await this.txTable
      .where({ pubKey, nonce })
      .limit(1)
      .select();

    return rows[0] ?? null;
  }

  /**
   * Find transactions for this public key after the provided nonce.
   *
   * Note: In nonce order.
   */
  async findAfter(
    pubKey: string,
    nonce: number,
    limit: number,
  ): Promise<TransactionData[]> {
    return await this.queryClient.query(
      `
        SELECT * from ${this.safeName}
        WHERE
          "pubKey" = $1 AND
          "nonce" > ${nonce}
        ORDER BY "nonce" ASC
        LIMIT ${limit}
      `,
      [pubKey],
    );
  }

  async drop() {
    await this.txTable.create(txOptions, CreateTableMode.DropIfExists);
  }

  async nextNonceOf(pubKey: string): Promise<number | null> {
    const results = await this.txTable
      .where({ pubKey })
      .order({
        column: "nonce",
        type: OrderByType.Descending,
      })
      .limit(1)
      .select();

    if (results.length === 0) {
      return null;
    }

    return results[0].nonce + 1;
  }

  async clear() {
    return await this.queryClient.query(`
      DELETE from ${this.safeName}
    `);
  }

  async clearBeforeId(txId: number) {
    await this.queryClient.query(`
      DELETE from ${this.safeName}
      WHERE "txId" < ${txId}
    `);
  }
}
