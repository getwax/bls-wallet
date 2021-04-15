import { QueryClient } from "./deps.ts";

const PG_HOST = "localhost";
const PG_PORT = 5432;
const PG_USER = "bls";
const PG_PASSWORD = "blstest";
const PG_DB_NAME = "bls_aggregator";

const client = new QueryClient({
  hostname : PG_HOST,
  port: PG_PORT,
  user : PG_USER,
  password : PG_PASSWORD,
  database : PG_DB_NAME,
  tls: {
    enforce: false
  }
})

import txService from "./txService.ts";

export async function initTables() {
  await txService.init();
}


export { client };
