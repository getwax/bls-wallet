import { QueryClient } from "../../deps.ts";
import Mutex from "../helpers/Mutex.ts";

export default async function runQueryGroup<T>(
  mutex: Mutex,
  queryClient: QueryClient,
  body: () => Promise<T>,
) {
  const lock = await mutex.Lock();
  let completed = false;

  try {
    queryClient.query("BEGIN");
    const result = await body();
    completed = true;
    return result;
  } finally {
    lock.release();
    await queryClient.query(completed ? "COMMIT" : "ROLLBACK");
  }
}
