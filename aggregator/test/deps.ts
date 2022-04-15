export * from "../deps.ts";

export { assert } from "https://deno.land/std@0.102.0/testing/asserts.ts";

import { assertEquals as assertLooseEquals, AssertionError } from "https://deno.land/std@0.102.0/testing/asserts.ts";
export { assertLooseEquals };

import { AddBundleResponse } from "../src/app/BundleService.ts";

// Simply delegates to std assertEquals (exported as assertLooseEquals) but
// helps writing correct assertions by checking the types are equal.
export function assertEquals<L, R extends L>(left: L, right: R) {
  assertLooseEquals(left, right);
}

export function assertBundleSucceeds(res: AddBundleResponse) {
  if ("failures" in res) {
    throw new AssertionError("expected bundle to succeed");
  }
}

export function assertBundleFails(res: AddBundleResponse) {
  if ("hash" in res) {
    throw new AssertionError("expected bundle to fail");
  }
}

