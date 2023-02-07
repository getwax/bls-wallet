import { sqlite } from "../../deps.ts";
import Mutex from "../helpers/Mutex.ts";
import AppEvent from "./AppEvent.ts";

export default async function runQueryGroup<T>(
  emit: (evt: AppEvent) => void,
  db: sqlite.DB,
  mutex: Mutex,
  body: () => Promise<T>,
) {
  const lock = await mutex.Lock();
  let completed = false;

  try {
    db.query("BEGIN");
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
    db.query(completed ? "COMMIT" : "ROLLBACK");
  }
}
