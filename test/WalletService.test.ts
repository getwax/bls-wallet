import { assert } from "./deps.ts";

import WalletService from "../src/app/WalletService.ts";

// deno-lint-ignore no-explicit-any
type ExplicitAny = any;

function testWrapper(testFn: () => void | Promise<void>) {
  return async () => {
    try {
      await testFn();
    } catch (error) {
      if (!(error.error instanceof Error)) {
        throw error;
      }

      let innerError = error.error;

      while (innerError.error instanceof Error) {
        innerError = innerError.error;
      }

      const wrappedError = new Error(
        `\n  innermost error: ${innerError.message}` +
          `\n\n  error: ${error.message}`,
      );

      (wrappedError as ExplicitAny).error = error;

      throw wrappedError;
    }
  };
}

Deno.test({
  name: "WalletService gets aggregator balance",
  sanitizeOps: false,
  fn: async () => {
    const walletService = new WalletService();

    assert(
      (await walletService.getAggregatorBalance()).gt(0),
    );
  },
});

Deno.test({
  name: "WalletService sends empty aggregate transaction",
  sanitizeOps: false,
  fn: testWrapper(async () => {
    const walletService = new WalletService();

    await walletService.sendTxs([]);
  }),
});
