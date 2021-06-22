export * from "../deps/index.ts";

export { assert } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import { assertEquals as assertLooseEquals } from "https://deno.land/std@0.97.0/testing/asserts.ts";
export { assertLooseEquals };

// Simply delegates to std assertEquals (exported as assertLooseEquals) but
// helps writing correct assertions by checking the types are equal.
export function assertEquals<L, R extends L>(left: L, right: R) {
  assertLooseEquals(left, right);
}

export { expect, mock } from "https://deno.land/x/expect@v0.2.6/mod.ts";
