#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env

import { BigNumber, sqlite } from "../deps.ts";
import * as env from "../src/env.ts";
import BundleTable from "../src/app/BundleTable.ts";

const table = new BundleTable(new sqlite.DB(env.DB_PATH));

console.log(table.count());
console.log(table.all().map((bun) => bun.id));
console.log(
  "findEligible",
  table.findEligible(BigNumber.from(0), 1000).map((bun) => bun.id)
);
