#!/usr/bin/env -S deno run --allow-net --unstable --allow-read

import createQueryClient from "../src/app/createQueryClient.ts";
import * as env from "../src/env.ts";
import TxTable from "../src/app/TxTable.ts";

const queryClient = createQueryClient(() => {});

for (const tableName of [env.TX_TABLE_NAME, env.FUTURE_TX_TABLE_NAME]) {
  const table = await TxTable.create(queryClient, tableName);
  console.log(tableName, await table.count());
  console.log(tableName, (await table.all()).map((tx) => tx.txId));
  console.log(
    tableName,
    "highestPriority",
    (await table.getHighestPriority(1000)).map((tx) => tx.txId),
  );
}
