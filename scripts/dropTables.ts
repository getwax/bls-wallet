// Useful for when breaking database changes are made.

import createQueryClient from "../src/app/createQueryClient.ts";
import * as env from "../src/app/env.ts";
import TxTable from "../src/app/TxTable.ts";

const queryClient = createQueryClient();

for (const tableName of [env.TX_TABLE_NAME, env.PENDING_TX_TABLE_NAME]) {
  const table = await TxTable.create(queryClient, tableName);
  await table.drop();
  console.log(`dropped table ${tableName}`);
}
