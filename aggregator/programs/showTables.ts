#!/usr/bin/env -S deno run --unstable --allow-net --allow-read --allow-env

import { BigNumber, sqlite } from "../deps.ts";
import * as env from "../src/env.ts";
import BundleTable from "../src/app/BundleTable.ts";

for (const tableName of [env.BUNDLE_TABLE_NAME]) {
  const table = new BundleTable(new sqlite.DB("aggregator.sqlite"));
  console.log(tableName, table.count());
  console.log(tableName, table.all().map((bun) => bun.id));
  console.log(
    tableName,
    "findEligible",
    table.findEligible(BigNumber.from(0), 1000).map((bun) => bun.id),
  );
}
