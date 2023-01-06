#!/usr/bin/env -S deno run --unstable --allow-net --allow-read --allow-env

import { BigNumber } from "../deps.ts";
import createQueryClient from "../src/app/createQueryClient.ts";
import * as env from "../src/env.ts";
import BundleTable from "../src/app/BundleTable.ts";

const queryClient = createQueryClient(() => {});

for (const tableName of [env.BUNDLE_TABLE_NAME]) {
  const table = await BundleTable.create(queryClient, tableName);
  console.log(tableName, await table.count());
  console.log(tableName, (await table.all()).map((bun) => bun.id));
  console.log(
    tableName,
    "findEligible",
    (await table.findEligible(BigNumber.from(0), 1000)).map((bun) => bun.id),
  );
}
