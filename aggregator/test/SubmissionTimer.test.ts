import { assertEquals } from "./deps.ts";

import SubmissionTimer from "../src/app/SubmissionTimer.ts";
import TestClock from "./helpers/TestClock.ts";

function Fixture() {
  const clock = new TestClock();
  const submissionTimes: number[] = [];

  const timer = new SubmissionTimer(
    clock,
    5000,
    () => {
      submissionTimes.push(clock.now() - TestClock.startTime);
      return Promise.resolve();
    },
  );

  return { clock, timer, submissionTimes };
}

Deno.test("SubmissionTimer triggers after configured delay", async () => {
  const { clock, timer, submissionTimes } = Fixture();

  timer.notifyTxWaiting();
  await clock.advance(5000);

  assertEquals(submissionTimes, [5000]);
});

Deno.test("SubmissionTimer does not trigger again if not notified", async () => {
  const { clock, timer, submissionTimes } = Fixture();

  timer.notifyTxWaiting();
  await clock.advance(5000);
  assertEquals(submissionTimes, [5000]);

  await clock.advance(1e12);
  assertEquals(submissionTimes, [5000]); // No new submissions
});

Deno.test(
  [
    "SubmissionTimer does not queue an extra submission when notified while a submission is",
    "already queued",
  ].join(" "),
  async () => {
    const { clock, timer, submissionTimes } = Fixture();

    timer.notifyTxWaiting();
    await clock.advance(1000);
    timer.notifyTxWaiting();
    timer.notifyTxWaiting();
    timer.notifyTxWaiting();
    await clock.advance(4000);
    assertEquals(submissionTimes, [5000]);

    await clock.advance(1e12);
    assertEquals(submissionTimes, [5000]); // No new submissions
  },
);

Deno.test(
  [
    "SubmissionTimer does not trigger early after being notified after a long",
    "period of inactivity",
  ].join(" "),
  async () => {
    const { clock, timer, submissionTimes } = Fixture();

    timer.notifyTxWaiting();
    await clock.advance(5000);
    assertEquals(submissionTimes, [5000]);

    await clock.advance(123456);
    timer.notifyTxWaiting();
    await clock.advance(5000);
    assertEquals(submissionTimes, [5000, 5000 + 123456 + 5000]);

    await clock.advance(1e12);
    assertEquals(submissionTimes, [5000, 5000 + 123456 + 5000]); // No new submissions
  },
);

Deno.test(
  "SubmissionTimer can be triggered manually at any time",
  async () => {
    const { clock, timer, submissionTimes } = Fixture();

    timer.trigger();
    assertEquals(submissionTimes, [0]);

    await clock.advance(123);
    timer.trigger();
    assertEquals(submissionTimes, [0, 123]);

    await clock.advance(10000);
    timer.trigger();
    assertEquals(submissionTimes, [0, 123, 10123]);
  },
);

Deno.test(
  [
    "When SubmissionTimer is triggered manually, submissions that would have been",
    "triggered by time no longer occur",
  ].join(" "),
  async () => {
    const { clock, timer, submissionTimes } = Fixture();

    timer.notifyTxWaiting();
    await clock.advance(100);
    timer.trigger();
    await clock.advance(5000);

    assertEquals(submissionTimes, [100]);
  },
);
