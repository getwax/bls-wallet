import { QueryClient } from "../../deps/index.ts";

import * as env from "./env.ts";

export default function createQueryClient(): QueryClient {
  const client = new QueryClient({
    hostname: env.PG.HOST,
    port: env.PG.PORT,
    user: env.PG.USER,
    password: env.PG.PASSWORD,
    database: env.PG.DB_NAME,
    tls: {
      enforce: false,
    },
  });

  if (env.LOG_QUERIES) {
    const originalQuery = client.query.bind(client);

    client.query = async (...args) => {
      console.log("query:", ...args);
      return await originalQuery(...args);
    };
  }

  return client;
}
