import { assert } from "./deps.ts";

import WalletService from "../src/app/WalletService.ts";

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
