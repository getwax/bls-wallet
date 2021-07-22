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
  const dummyTxData: TransactionData = {
    "pubKey": [
      "0x000102030405060708091011121314151617181920212223242526272829303132333",
      "43536373839404142434445464748495051525354555657585960616263646566676869",
      "70717273747576777879808182838485868788899091929394959697989900010203040",
      "506070809101112131415161718192021222324252627",
    ].join(""),
    "nonce": 1,
    "signature": [
      "0x000102030405060708091011121314151617181920212223242526272829303132333",
      "43536373839404142434445464748495051525354555657585960616263",
    ].join(""),
    "tokenRewardAmount": [
      "0x0001020304050607080910111213141516171819202122232425262728293031",
    ].join(""),
    "contractAddress": "0x0001020304050607080910111213141516171819",
    "methodId": "0x00010203",
    "encodedParams": "0x00010203040506",
  };

  assertEquals(
    parseTransactionData(dummyTxData),
    { success: dummyTxData },
  );
});
