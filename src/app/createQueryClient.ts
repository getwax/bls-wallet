import { QueryClient } from "../../deps/index.ts";

import * as env from "./env.ts";

export default function createQueryClient(): QueryClient {
  return new QueryClient({
    hostname: env.PG.HOST,
    port: env.PG.PORT,
    user: env.PG.USER,
    password: env.PG.PASSWORD,
    database: env.PG.DB_NAME,
    tls: {
      enforce: false,
    },
  });
}
