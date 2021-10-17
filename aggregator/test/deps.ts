export * from "../deps.ts";

export { assert } from "https://deno.land/std@0.102.0/testing/asserts.ts";

import { assertEquals as assertLooseEquals } from "https://deno.land/std@0.102.0/testing/asserts.ts";
export { assertLooseEquals };

// Simply delegates to std assertEquals (exported as assertLooseEquals) but
// helps writing correct assertions by checking the types are equal.
export function assertEquals<L, R extends L>(left: L, right: R) {
  assertLooseEquals(left, right);
}
