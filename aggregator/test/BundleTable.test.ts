import { assertEquals, BigNumber } from "./deps.ts";

import BundleTable, { BundleRow } from "../src/app/BundleTable.ts";
import createQueryClient from "../src/app/createQueryClient.ts";

let counter = 0;

function test(name: string, fn: (bundleTable: BundleTable) => Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    fn: async () => {
      const tableName = `bundles_test_${counter++}_${Date.now()}`;

      const queryClient = createQueryClient(() => {});
      const table = await BundleTable.create(queryClient, tableName);

      try {
        await fn(table);
      } finally {
        try {
          await table.drop();
          await queryClient.disconnect();
        } catch (error) {
          console.error("cleanup error:", error);
        }
      }
    },
  });
}

const sampleRows: BundleRow[] = [
  {
    id: 0,
    hash: "0x0",
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
    submitError: "",
    eligibleAfter: BigNumber.from(0),
    nextEligibilityDelay: BigNumber.from(1),
  },
];

test("Starts with zero transactions", async (table) => {
  assertEquals(await table.count(), 0n);
});

test("Has one transaction after adding transaction", async (table) => {
  await table.add(sampleRows[0]);

  assertEquals(await table.count(), 1n);
});

test("Can retrieve transaction", async (table) => {
  await table.add(sampleRows[0]);

  assertEquals(await table.all(), [{ ...sampleRows[0] }]);
});
