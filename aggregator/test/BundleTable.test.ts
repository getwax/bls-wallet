import { assertEquals, BigNumber, sqlite } from "./deps.ts";

import BundleTable, { BundleRow } from "../src/app/BundleTable.ts";
import nil from "../src/helpers/nil.ts";

const sampleRows: BundleRow[] = [
  {
    id: 1,
    hash: "0x0",
    status: "pending",
    bundle: {
      senderPublicKeys: [["0x01", "0x02", "0x03", "0x04"]],
      operations: [
        {
          nonce: "0x01",
          actions: [
            {
              ethValue: "0x00",
              contractAddress: "0x00",
              encodedFunction: "0x000102",
            },
          ],
        },
      ],
      signature: ["0x00", "0x00"],
    },
    eligibleAfter: BigNumber.from(0),
    nextEligibilityDelay: BigNumber.from(1),
    submitError: nil,
    receipt: nil,
  },
];

Deno.test("Starts with zero transactions", () => {
  const table = new BundleTable(new sqlite.DB());
  assertEquals(table.count(), 0);
});

Deno.test("Has one transaction after adding transaction", () => {
  const table = new BundleTable(new sqlite.DB());
  table.add(sampleRows[0]);
  assertEquals(table.count(), 1);
});

Deno.test("Can retrieve transaction", () => {
  const table = new BundleTable(new sqlite.DB());
  table.add(sampleRows[0]);
  assertEquals(table.all(), [{ ...sampleRows[0] }]);
});
