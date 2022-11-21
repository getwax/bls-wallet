import {
  BigNumber,
  Bundle,
  bundleFromDto,
  bundleToDto,
  Constraint,
  CreateTableMode,
  DataType,
  ethers,
  QueryClient,
  QueryTable,
  TableOptions,
  unsketchify,
} from "../../deps.ts";

import assertExists from "../helpers/assertExists.ts";
import { parseBundleDto } from "./parsers.ts";

/**
 * Representation used when talking to the database. It's 'raw' in the sense
 * that it only uses primitive types, because the database cannot know about
 * custom classes like BigNumber.
 */
type RawRow = {
  id: number;
  hash: string;
  bundle: string;
  eligibleAfter: string;
  nextEligibilityDelay: string;
  submitError: string;
};

type Row = {
  id: number;
  hash: string;
  bundle: Bundle;
  eligibleAfter: BigNumber;
  nextEligibilityDelay: BigNumber;
  submitError: string;
};

type InsertRow = Omit<Row, "id">;
type InsertRawRow = Omit<RawRow, "id">;

export function makeHash() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return ethers.utils.hexlify(buf);
}

export type BundleRow = Row;

const tableOptions: TableOptions = {
  id: { type: DataType.Serial, constraint: Constraint.PrimaryKey },
  hash: { type: DataType.VarChar },
  bundle: { type: DataType.VarChar },
  submitError: { type: DataType.VarChar },
  eligibleAfter: { type: DataType.VarChar },
  nextEligibilityDelay: { type: DataType.VarChar },
};

function fromRawRow(rawRow: RawRow): Row {
  const parseResult = parseBundleDto(JSON.parse(rawRow.bundle));

  if ("failures" in parseResult) {
    throw new Error(parseResult.failures.join("\n"));
  }

  return {
    ...rawRow,
    bundle: bundleFromDto(parseResult.success),
    eligibleAfter: BigNumber.from(rawRow.eligibleAfter),
    nextEligibilityDelay: BigNumber.from(rawRow.nextEligibilityDelay),
  };
}

function toInsertRawRow(row: InsertRow): InsertRawRow {
  return {
    ...row,
    bundle: JSON.stringify(bundleToDto(row.bundle)),
    eligibleAfter: toUint256Hex(row.eligibleAfter),
    nextEligibilityDelay: toUint256Hex(row.nextEligibilityDelay),
  };
}

function toRawRow(row: Row): RawRow {
  return {
    ...row,
    bundle: JSON.stringify(bundleToDto(row.bundle)),
    eligibleAfter: toUint256Hex(row.eligibleAfter),
    nextEligibilityDelay: toUint256Hex(row.nextEligibilityDelay),
  };
}

export default class BundleTable {
  queryTable: QueryTable<RawRow>;
  safeName: string;

  private constructor(public queryClient: QueryClient, tableName: string) {
    this.queryTable = this.queryClient.table<RawRow>(tableName);
    this.safeName = unsketchify(this.queryTable.name);
  }

  static async create(
    queryClient: QueryClient,
    tableName: string,
  ): Promise<BundleTable> {
    const table = new BundleTable(queryClient, tableName);
    await table.queryTable.create(tableOptions, CreateTableMode.IfNotExists);

    return table;
  }

  static async createFresh(
    queryClient: QueryClient,
    tableName: string,
  ) {
    const table = new BundleTable(queryClient, tableName);
    await table.queryTable.drop(true);
    await table.queryTable.create(tableOptions, CreateTableMode.IfNotExists);

    return table;
  }

  async add(...rows: InsertRow[]) {
    await this.queryTable.insert(...rows.map(toInsertRawRow));
  }

  async update(row: Row) {
    await this.queryTable.where({ id: row.id }).update(toRawRow(row));
  }

  async remove(...rows: Row[]) {
    await Promise.all(rows.map((row) =>
      this.queryTable
        .where({ id: assertExists(row.id) })
        .delete()
    ));
  }

  async findEligible(blockNumber: BigNumber, limit: number) {
    const rows: RawRow[] = await this.queryClient.query(
      `
        SELECT * from ${this.safeName}
        WHERE
          "eligibleAfter" <= '${toUint256Hex(blockNumber)}'
        ORDER BY "id" ASC
        LIMIT ${limit}
      `,
    );
    return rows.map(fromRawRow);
  }

  async findBundle(hash: string) {
    const rows: RawRow[] = await this.queryClient.query(
      `
        SELECT * from ${this.safeName}
        WHERE
            "hash" = '${hash}'
      `,
    );
    return rows.map(fromRawRow);
  }

  async count(): Promise<bigint> {
    const result = await this.queryClient.query(
      `SELECT COUNT(*) FROM ${this.queryTable.name}`,
    );
    return result[0].count as bigint;
  }

  async all(): Promise<Row[]> {
    const rawRows: RawRow[] = await this.queryClient.query(
      `SELECT * FROM ${this.queryTable.name}`,
    );

    return rawRows.map(fromRawRow);
  }

  async drop() {
    await this.queryTable.drop(true);
  }

  async clear() {
    return await this.queryClient.query(`
      DELETE from ${this.safeName}
    `);
  }
}

function toUint256Hex(n: BigNumber) {
  return `0x${n.toHexString().slice(2).padStart(64, "0")}`;
}
