import { QueryClient } from "../../deps.ts";

import * as env from "../env.ts";
import AppEvent from "./AppEvent.ts";

export default function createQueryClient(
  emit: (evt: AppEvent) => void,
  /**
   * Sadly, there appears to be a singleton inside QueryClient, which forces us
   * to re-use it during testing.
   */
  existingClient?: QueryClient,
): QueryClient {
  const client = existingClient ?? new QueryClient({
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

    client.query = async (sql, params) => {
      emit({
        type: "db-query",
        data: { sql, params: params ?? [] },
      });

      return await originalQuery(sql, params);
    };
  }

  return client;
}
