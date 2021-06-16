// Useful for when breaking database changes are made.

import * as env from "../src/app/env.ts";
import TxTable from "../src/app/TxTable.ts";

const txTable = await TxTable.create(env.TX_TABLE_NAME);

await txTable.drop();
console.log(`dropped table ${env.TX_TABLE_NAME}`);
