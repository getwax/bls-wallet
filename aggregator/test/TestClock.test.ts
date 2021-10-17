import { assertEquals } from "./deps.ts";

import TestClock from "./helpers/TestClock.ts";

Deno.test("TestClock triggers timers in the correct order", async () => {
  const clock = new TestClock();
  const promises: Promise<unknown>[] = [];

  assertEquals(clock.now(), 1e12);

  const events: number[] = [];

  // Schedule some things all together
  for (let i = 1; i <= 10; i++) {
    const millis = 3 * i;
    promises.push(clock.wait(3 * i).then(() => events.push(millis)));
  }

  // Schedule some things chained together
  promises.push((async () => {
    for (let i = 1; i <= 6; i++) {
      await clock.wait(5);
      events.push(5 * i);
    }
  })());

  assertEquals(events, []);
  await clock.advance(15);
  assertEquals(events, [3, 5, 6, 9, 10, 12, 15, 15]);

  // Another trillion milliseconds (~30 years)
  await clock.advance(1e12);

  assertEquals(clock.now(), 2e12 + 15);

  assertEquals(
    events,
    [3, 5, 6, 9, 10, 12, 15, 15, 18, 20, 21, 24, 25, 27, 30, 30],
  );

  await Promise.all(promises);
});
