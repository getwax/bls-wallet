import { parseTransactionData } from "../src/app/parsers.ts";
import { TransactionData } from "../src/app/TxTable.ts";
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

Deno.test("parseTransactionData accepts dummy values", () => {
  // TODO: Be more strict, e.g. correctly formatted address

  const dummyTxData: TransactionData = {
    pubKey: "pubKey",
    nonce: 1,
    signature: "signature",
    tokenRewardAmount: "1",
    contractAddress: "contractAddress",
    methodId: "methodId",
    encodedParams: "encodedParams",
  };

  assertEquals(
    parseTransactionData(dummyTxData),
    { success: dummyTxData },
  );
});
