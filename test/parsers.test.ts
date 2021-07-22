import { parseTransactionData } from "../src/app/parsers.ts";
import { assertEquals } from "./deps.ts";

Deno.test("parseTransactionData reports missing fields for undefined", () => {
  assertEquals(
    parseTransactionData(undefined),
    {
      failures: [
        "field pubKey: not provided",
        "field nonce: not provided",
        "field signature: not provided",
        "field tokenRewardAmount: not provided",
        "field contractAddress: not provided",
        "field methodId: not provided",
        "field encodedParams: not provided",
      ],
    },
  );
});
