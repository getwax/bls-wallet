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
  await clock.advance(5000);

  assertEquals(batchTimes, [5000]);
});

Deno.test("BatchTimer does not trigger again if not notified", async () => {
  const { clock, timer, batchTimes } = Fixture();

  timer.notifyTxWaiting();
  await clock.advance(5000);
  assertEquals(batchTimes, [5000]);

  await clock.advance(1e12);
  assertEquals(batchTimes, [5000]); // No new batches
});

Deno.test(
  [
    "BatchTimer does not queue an extra batch when notified while a batch is",
    "already queued",
  ].join(" "),
  async () => {
    const { clock, timer, batchTimes } = Fixture();

    timer.notifyTxWaiting();
    await clock.advance(1000);
    timer.notifyTxWaiting();
    timer.notifyTxWaiting();
    timer.notifyTxWaiting();
    await clock.advance(4000);
    assertEquals(batchTimes, [5000]);

    await clock.advance(1e12);
    assertEquals(batchTimes, [5000]); // No new batches
  },
);

Deno.test(
  [
    "BatchTimer does not trigger early after being notified after a long",
    "period of inactivity",
  ].join(" "),
  async () => {
    const { clock, timer, batchTimes } = Fixture();

    timer.notifyTxWaiting();
    await clock.advance(5000);
    assertEquals(batchTimes, [5000]);

    await clock.advance(123456);
    timer.notifyTxWaiting();
    await clock.advance(5000);
    assertEquals(batchTimes, [5000, 5000 + 123456 + 5000]);

    await clock.advance(1e12);
    assertEquals(batchTimes, [5000, 5000 + 123456 + 5000]); // No new batches
  },
);

Deno.test(
  "BatchTimer can be triggered manually at any time",
  async () => {
    const { clock, timer, batchTimes } = Fixture();

    timer.trigger();
    assertEquals(batchTimes, [0]);

    await clock.advance(123);
    timer.trigger();
    assertEquals(batchTimes, [0, 123]);

    await clock.advance(10000);
    timer.trigger();
    assertEquals(batchTimes, [0, 123, 10123]);
  },
);

Deno.test(
  [
    "When BatchTimer is triggered manually, batches that would have been",
    "triggered by time no longer occur",
  ].join(" "),
  async () => {
    const { clock, timer, batchTimes } = Fixture();

    timer.notifyTxWaiting();
    await clock.advance(100);
    timer.trigger();
    await clock.advance(5000);

    assertEquals(batchTimes, [100]);
  },
);
