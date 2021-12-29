import { parseBundleDto } from "../src/app/parsers.ts";
import { assertEquals, BundleDto } from "./deps.ts";

Deno.test("parseBundleDto reports not-an-object for undefined", () => {
  assertEquals(
    parseBundleDto(undefined),
    { failures: ["not an object"] },
  );
});

Deno.test("parseBundleDto reports missing fields", () => {
  assertEquals(
    parseBundleDto({}),
    {
      failures: [
        "field senderPublicKeys: not provided",
        "field operations: not provided",
        "field signature: not provided",
      ],
    },
  );
});

Deno.test("parseBundleDto accepts dummy values", () => {
  const dummyBundleData: BundleDto = {
    "senderPublicKeys": [
      ["0x01", "0x02", "0x03", "0x04"],
    ],
    "operations": [
      {
        "nonce": "0x01",
        "actions": [
          {
            "ethValue": "0x00",
            "contractAddress": "0x00",
            "encodedFunction": "0x00",
          },
        ],
      },
    ],
    "signature": ["0x01", "0x02"],
  };

  assertEquals(
    parseBundleDto(dummyBundleData),
    { success: dummyBundleData },
  );
});
