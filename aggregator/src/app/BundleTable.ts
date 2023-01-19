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
import ExplicitAny from "../helpers/ExplicitAny.ts";
import { parseBundleDto } from "./parsers.ts";
import nil from "../helpers/nil.ts";

/**
 * Representation used when talking to the database. It's 'raw' in the sense
 * that it only uses primitive types, because the database cannot know about
 * custom classes like BigNumber.
 */
type RawRow = {
  id: number;
  status: string;
  hash: string;
  bundle: string;
  eligibleAfter: string;
  nextEligibilityDelay: string;
  submitError: string | null;
  receipt: string | null;
};

const BundleStatuses = ["pending", "confirmed", "failed"] as const;
type BundleStatus = typeof BundleStatuses[number];

type Row = {
  id: number;
  status: BundleStatus;
  hash: string;
  bundle: Bundle;
  eligibleAfter: BigNumber;
  nextEligibilityDelay: BigNumber;
  submitError?: string;
  receipt?: ethers.ContractReceipt;
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
  status: { type: DataType.VarChar },
  hash: { type: DataType.VarChar },
  bundle: { type: DataType.VarChar },
  submitError: { type: DataType.VarChar, nullable: true },
  eligibleAfter: { type: DataType.VarChar },
  nextEligibilityDelay: { type: DataType.VarChar },
  receipt: { type: DataType.VarChar },
};

function fromRawRow(rawRow: RawRow): Row {
  const parseBundleResult = parseBundleDto(JSON.parse(rawRow.bundle));
  if ("failures" in parseBundleResult) {
    throw new Error(parseBundleResult.failures.join("\n"));
  }

  const status = rawRow.status;
  if (!isValidStatus(status)) {
    throw new Error(`Not a valid bundle status: ${status}`);
  }

  const receipt: ethers.ContractReceipt = rawRow.receipt
    ? JSON.parse(rawRow.receipt)
    : nil;

  return {
    ...rawRow,
    submitError: rawRow.submitError ?? nil,
    bundle: bundleFromDto(parseBundleResult.success),
    eligibleAfter: BigNumber.from(rawRow.eligibleAfter),
    nextEligibilityDelay: BigNumber.from(rawRow.nextEligibilityDelay),
    receipt,
    status,
  };
}

function toInsertRawRow(row: InsertRow): InsertRawRow {
  return {
    ...row,
    submitError: row.submitError ?? null,
    bundle: JSON.stringify(bundleToDto(row.bundle)),
    eligibleAfter: toUint256Hex(row.eligibleAfter),
    nextEligibilityDelay: toUint256Hex(row.nextEligibilityDelay),
    receipt: JSON.stringify(row.receipt),
  };
}

function toRawRow(row: Row): RawRow {
  return {
    ...row,
    submitError: row.submitError ?? null,
    bundle: JSON.stringify(bundleToDto(row.bundle)),
    eligibleAfter: toUint256Hex(row.eligibleAfter),
    nextEligibilityDelay: toUint256Hex(row.nextEligibilityDelay),
    receipt: JSON.stringify(row.receipt),
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
        WHERE 1=1
          AND "eligibleAfter" <= '${toUint256Hex(blockNumber)}'
          AND "status" = 'pending'
        ORDER BY "id" ASC
        LIMIT ${limit}
      `,
    );
    return rows.map(fromRawRow);
  }

  async findBundle(hash: string): Promise<Row | nil> {
    const rows: RawRow[] = await this.queryClient.query(
      `
        SELECT * from ${this.safeName}
        WHERE
            "hash" = '${hash}'
      `,
    );
    return rows.map(fromRawRow)[0];
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

function isValidStatus(status: unknown): status is BundleStatus {
  return typeof status === "string" &&
    BundleStatuses.includes(status as ExplicitAny);
}
