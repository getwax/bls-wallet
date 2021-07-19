import { assertEquals } from "./deps.ts";

import BatchTimer from "../src/app/BatchTimer.ts";
import TestClock from "./helpers/TestClock.ts";

function Fixture() {
  const clock = new TestClock();
  const batchTimes: number[] = [];

  const timer = new BatchTimer(
    clock,
    5000,
    () => {
      batchTimes.push(clock.now() - TestClock.startTime);
    },
  );

  return { clock, timer, batchTimes };
}

Deno.test("BatchTimer triggers after configured delay", async () => {
  const { clock, timer, batchTimes } = Fixture();

  timer.notifyTxWaiting();
  await clock.advance(1e12);

  assertEquals(batchTimes, [5000]);
});
