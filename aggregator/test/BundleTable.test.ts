import { assertEquals, BigNumber, sqlite } from "./deps.ts";

import BundleTable, { BundleRow } from "../src/app/BundleTable.ts";
import nil from "../src/helpers/nil.ts";

function test(
  name: string,
  fn: (bundleTable: BundleTable) => void | Promise<void>,
) {
  Deno.test({
    name,
    sanitizeResources: false,
    fn: async () => {
      const table = new BundleTable(new sqlite.DB());
      await fn(table);
    },
  });
}

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

test("Starts with zero transactions", (table) => {
  assertEquals(table.count(), 0);
});

test("Has one transaction after adding transaction", (table) => {
  table.add(sampleRows[0]);
  assertEquals(table.count(), 1);
});

test("Can retrieve transaction", (table) => {
  table.add(sampleRows[0]);
  assertEquals(table.all(), [{ ...sampleRows[0] }]);
});
