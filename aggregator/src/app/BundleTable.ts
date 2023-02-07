import {
  BigNumber,
  Bundle,
  bundleFromDto,
  bundleToDto,
  ethers,
  sqlite,
} from "../../deps.ts";

import assertExists from "../helpers/assertExists.ts";
import ExplicitAny from "../helpers/ExplicitAny.ts";
import { parseBundleDto } from "./parsers.ts";
import nil from "../helpers/nil.ts";
import assert from "../helpers/assert.ts";

/**
 * Representation used when talking to the database. It's 'raw' in the sense
 * that it only uses primitive types, because the database cannot know about
 * custom classes like BigNumber.
 *
 * Note that this isn't as raw as it used to be - sqlite returns each row as an
 * array. This is still the raw representation of each field though.
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

function fromRawRow(rawRow: RawRow | sqlite.Row): Row {
  if (Array.isArray(rawRow)) {
    rawRow = {
      id: rawRow[0],
      status: rawRow[1],
      hash: rawRow[2],
      bundle: rawRow[3],
      eligibleAfter: rawRow[4],
      nextEligibilityDelay: rawRow[5],
      submitError: rawRow[6],
      receipt: rawRow[7],
    };
  }

  const parseBundleResult = parseBundleDto(
    JSON.parse(rawRow.bundle),
  );

  if ("failures" in parseBundleResult) {
    throw new Error(parseBundleResult.failures.join("\n"));
  }

  const status = rawRow.status;
  if (!isValidStatus(status)) {
    throw new Error(`Not a valid bundle status: ${status}`);
  }

  const rawReceipt = rawRow.receipt;

  const receipt: ethers.ContractReceipt = rawReceipt
    ? JSON.parse(rawReceipt)
    : nil;

  return {
    id: rawRow.id,
    status,
    hash: rawRow.hash,
    bundle: bundleFromDto(parseBundleResult.success),
    eligibleAfter: BigNumber.from(rawRow.eligibleAfter),
    nextEligibilityDelay: BigNumber.from(rawRow.nextEligibilityDelay),
    submitError: rawRow.submitError ?? nil,
    receipt,
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
    id: row.id,
    status: row.status,
    hash: row.hash,
    bundle: JSON.stringify(row.bundle),
    eligibleAfter: toUint256Hex(row.eligibleAfter),
    nextEligibilityDelay: toUint256Hex(row.nextEligibilityDelay),
    submitError: row.submitError ?? null,
    receipt: JSON.stringify(row.receipt),
  };
}

export default class BundleTable {
  constructor(
    public db: sqlite.DB,
    public onQuery = (_sql: string, _params?: sqlite.QueryParameterSet) => {},
  ) {
    this.dbQuery(`
      CREATE TABLE IF NOT EXISTS bundles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL,
        hash TEXT NOT NULL,
        bundle TEXT NOT NULL,
        eligibleAfter TEXT NOT NULL,
        nextEligibilityDelay TEXT NOT NULL,
        submitError TEXT,
        receipt TEXT
      )
    `);
  }

  dbQuery(sql: string, params?: sqlite.QueryParameterSet) {
    this.onQuery(sql, params);
    return this.db.query(sql, params);
  }

  add(...rows: InsertRow[]) {
    for (const row of rows) {
      const rawRow = toInsertRawRow(row);

      this.dbQuery(
        `
          INSERT INTO bundles (
            id,
            status,
            hash,
            bundle,
            eligibleAfter,
            nextEligibilityDelay,
            submitError,
            receipt
          ) VALUES (
            :id,
            :status,
            :hash,
            :bundle,
            :eligibleAfter,
            :nextEligibilityDelay,
            :submitError,
            :receipt
          )
        `,
        {
          ":status": rawRow.status,
          ":hash": rawRow.hash,
          ":bundle": rawRow.bundle,
          ":eligibleAfter": rawRow.eligibleAfter,
          ":nextEligibilityDelay": rawRow.nextEligibilityDelay,
          ":submitError": rawRow.submitError,
          ":receipt": rawRow.receipt,
        },
      );
    }
  }

  update(row: Row) {
    const rawRow = toRawRow(row);

    this.dbQuery(
      `
        UPDATE bundles
        SET
          status = :status,
          hash = :hash,
          bundle = :bundle,
          eligibleAfter = :eligibleAfter,
          nextEligibilityDelay = :nextEligibilityDelay,
          submitError = :submitError,
          receipt = :receipt
        WHERE
          id = :id
      `,
      {
        ":id": rawRow.id,
        ":status": rawRow.status,
        ":hash": rawRow.hash,
        ":bundle": rawRow.bundle,
        ":eligibleAfter": rawRow.eligibleAfter,
        ":nextEligibilityDelay": rawRow.nextEligibilityDelay,
        ":submitError": rawRow.submitError,
        ":receipt": rawRow.receipt,
      },
    );
  }

  remove(...rows: Row[]) {
    for (const row of rows) {
      this.dbQuery(
        "DELETE FROM bundles WHERE id = :id",
        { ":id": assertExists(row.id) },
      );
    }
  }

  findEligible(blockNumber: BigNumber, limit: number): Row[] {
    const rows = this.dbQuery(
      `
        SELECT * from bundles
        WHERE
          eligibleAfter <= '${toUint256Hex(blockNumber)}' AND
          status = 'pending'
        ORDER BY id ASC
        LIMIT :limit
      `,
      {
        ":limit": limit,
      },
    );

    return rows.map(fromRawRow);
  }

  findBundle(hash: string): Row | nil {
    const rows = this.dbQuery(
      "SELECT * from bundles WHERE hash = :hash",
      { ":hash": hash },
    );

    return rows.map(fromRawRow)[0];
  }

  count(): number {
    const result = this.dbQuery("SELECT COUNT(*) FROM bundles")[0][0];
    assert(typeof result === "number");

    return result;
  }

  all(): Row[] {
    const rawRows = this.dbQuery(
      "SELECT * FROM bundles",
    );

    return rawRows.map(fromRawRow);
  }

  drop() {
    this.dbQuery("DROP TABLE bundles");
  }

  clear() {
    this.dbQuery("DELETE from bundles");
  }
}

function toUint256Hex(n: BigNumber) {
  return `0x${n.toHexString().slice(2).padStart(64, "0")}`;
}

function isValidStatus(status: unknown): status is BundleStatus {
  return typeof status === "string" &&
    BundleStatuses.includes(status as ExplicitAny);
}
