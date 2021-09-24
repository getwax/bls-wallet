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

/**
 * Representation used when talking to the database. It's 'raw' in the sense
 * that it only uses primitive types, because the database cannot know about
 * custom classes like BigNumber.
 */
type RawTxTableRow = {
  txId?: number;
  publicKey: string;
  signature: string;
  nonce: number;
  tokenRewardAmount: string;
  ethValue: string;
  contractAddress: string;
  encodedFunctionData: string;
};

const txOptions: TableOptions = {
  txId: { type: DataType.Serial, constraint: Constraint.PrimaryKey },
  publicKey: { type: DataType.VarChar, length: 258 },
  signature: { type: DataType.VarChar, length: 130 },
  nonce: { type: DataType.Integer },
  tokenRewardAmount: { type: DataType.VarChar, length: 66 },
  ethValue: { type: DataType.VarChar, length: 66 },
  contractAddress: { type: DataType.VarChar, length: 42 },
  encodedFunctionData: { type: DataType.VarChar },
};

export type TxTableRow = TransactionData & { txId?: number };

function toRawRow(row: TxTableRow): RawTxTableRow {
  return {
    ...row,

    // This will cause problems from 2^31 because we're using 32 bit integers.
    // It's also a problem from 2^53 for js numbers.
    //
    // More information:
    // - https://github.com/jzaki/bls-wallet-aggregator/issues/36
    nonce: row.nonce.toNumber(),

    tokenRewardAmount: row.tokenRewardAmount.toHexString(),
    ethValue: row.ethValue.toHexString(),
  };
}

function fromRawRow(row: RawTxTableRow): TxTableRow {
  return {
    ...row,
    nonce: BigNumber.from(row.nonce),
    tokenRewardAmount: BigNumber.from(row.tokenRewardAmount),
    ethValue: BigNumber.from(row.ethValue),
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

  async findSingle(
    publicKey: string,
    nonce: BigNumber,
  ): Promise<TxTableRow | nil> {
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
