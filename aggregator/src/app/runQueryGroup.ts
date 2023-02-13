import Mutex from "../helpers/Mutex.ts";
import AppEvent from "./AppEvent.ts";

export default async function runQueryGroup<T>(
  emit: (evt: AppEvent) => void,
  query: (sql: string) => void,
  mutex: Mutex,
  body: () => Promise<T>,
) {
  const lock = await mutex.Lock();
  let completed = false;

  try {
    query("BEGIN");
    const result = await body();
    completed = true;
    return result;
  } catch (error) {
    emit({
      type: "error",
      data: error.stack,
    });

    throw error;
  } finally {
    lock.release();
    query(completed ? "COMMIT" : "ROLLBACK");
  }
}
