import {
  BigNumber,
  Constraint,
  CreateTableMode,
  DataType,
  OrderByType,
  QueryClient,
  QueryTable,
  TableOptions,
  TransactionData,
  unsketchify,
} from "../../deps.ts";

import assertExists from "../helpers/assertExists.ts";
import nil from "../helpers/nil.ts";

type RawTxTableRow = {
  txId?: number;
  contractAddress: string;
  encodedFunctionData: string;
  nonce: number;
  tokenRewardAmount: string;
  publicKey: string;
  signature: string;
};

const txOptions: TableOptions = {
  txId: { type: DataType.Serial, constraint: Constraint.PrimaryKey },
  contractAddress: { type: DataType.VarChar, length: 42 },
  encodedFunctionData: { type: DataType.VarChar },
  nonce: { type: DataType.Integer },
  tokenRewardAmount: { type: DataType.VarChar, length: 66 },
  publicKey: { type: DataType.VarChar, length: 258 },
  signature: { type: DataType.VarChar, length: 130 },
};

export type TxTableRow = TransactionData & { txId?: number };

function toRawRow(row: TxTableRow): RawTxTableRow {
  return {
    ...row,
    nonce: row.nonce.toNumber(),
    tokenRewardAmount: row.tokenRewardAmount.toHexString(),
  };
}

function fromRawRow(row: RawTxTableRow): TxTableRow {
  return {
    ...row,
    nonce: BigNumber.from(row.nonce),
    tokenRewardAmount: BigNumber.from(row.tokenRewardAmount),
  };
}

export default class TxTable {
  txTable: QueryTable<RawTxTableRow>;
  safeName: string;

  private constructor(public queryClient: QueryClient, txTableName: string) {
    this.txTable = this.queryClient.table<RawTxTableRow>(txTableName);
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

  static async createFresh(
    queryClient: QueryClient,
    txTableName: string,
  ) {
    const txTable = new TxTable(queryClient, txTableName);
    await txTable.txTable.drop(true);
    await txTable.txTable.create(txOptions, CreateTableMode.IfNotExists);

    return txTable;
  }

  async add(...txs: TxTableRow[]) {
    await this.txTable.insert(...txs.map(toRawRow));
  }

  async addWithNewId(...txs: TxTableRow[]) {
    const txsWithoutIds = txs.map((tx) => {
      const txWithoutId = { ...tx };
      delete txWithoutId.txId;
      return txWithoutId;
    });

    return await this.add(...txsWithoutIds);
  }

  async remove(...txs: TxTableRow[]) {
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

  async getHighestPriority(limit: number): Promise<TxTableRow[]> {
    const rows = await this.txTable
      .where()
      .order({
        column: "txId",
        type: OrderByType.Ascending,
      })
      .limit(limit)
      .select();

    return rows.map(fromRawRow);
  }

  async publicKeyTxsInNonceOrder(
    publicKey: string,
    limit: number,
  ): Promise<TxTableRow[]> {
    const rows = await this.txTable
      .where({ publicKey })
      .order({
        column: "nonce",
        type: OrderByType.Ascending,
      })
      .limit(limit)
      .select();

    return rows.map(fromRawRow);
  }

  async all(): Promise<TxTableRow[]> {
    const rows: RawTxTableRow[] = await this.queryClient.query(
      `SELECT * FROM ${this.txTable.name}`,
    );

    return rows.map(fromRawRow);
  }

  async find(publicKey: string, nonce: BigNumber): Promise<TxTableRow | nil> {
    const rows = await this.txTable
      .where({ publicKey, nonce: nonce.toNumber() })
      .limit(1)
      .select();

    return rows[0] && fromRawRow(rows[0]);
  }

  /**
   * Find transactions for this public key after the provided nonce.
   *
   * Note: In nonce order.
   */
  async findAfter(
    publicKey: string,
    nonce: BigNumber,
    limit: number,
  ): Promise<TxTableRow[]> {
    const rows: RawTxTableRow[] = await this.queryClient.query(
      `
        SELECT * from ${this.safeName}
        WHERE
          "publicKey" = $1 AND
          "nonce" > ${nonce.toNumber()}
        ORDER BY "nonce" ASC
        LIMIT ${limit}
      `,
      [publicKey],
    );

    return rows.map(fromRawRow);
  }

  async drop() {
    await this.txTable.create(txOptions, CreateTableMode.DropIfExists);
  }

  async nextNonceOf(publicKey: string): Promise<BigNumber> {
    const results = await this.txTable
      .where({ publicKey })
      .order({
        column: "nonce",
        type: OrderByType.Descending,
      })
      .limit(1)
      .select();

    if (results.length === 0) {
      return BigNumber.from(0);
    }

    return BigNumber.from(results[0].nonce + 1);
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
