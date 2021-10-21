import { assertEquals, BigNumber, TransactionData } from "./deps.ts";

import TxTable from "../src/app/TxTable.ts";
import createQueryClient from "../src/app/createQueryClient.ts";

let counter = 0;

function test(name: string, fn: (txTable: TxTable) => Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    fn: async () => {
      const tableName = `txs_test_${counter++}_${Date.now()}`;

      const queryClient = createQueryClient(() => {});
      const txTable = await TxTable.create(queryClient, tableName);

      try {
        await fn(txTable);
      } finally {
        try {
          await txTable.drop();
          await queryClient.disconnect();
        } catch (error) {
          console.error("cleanup error:", error);
        }
      }
    },
  });
}

const sampleTransactions: TransactionData[] = [
  {
    publicKey: "publicKey",
    nonce: BigNumber.from(123),
    signature: "signature",
    ethValue: BigNumber.from(0),
    contractAddress: "contractAddress",
    encodedFunction: "encodedFunctionData",
  },
];

test("Starts with zero transactions", async (txTable) => {
  assertEquals(await txTable.count(), 0n);
});

test("Has one transaction after adding transaction", async (txTable) => {
  await txTable.add(sampleTransactions[0]);

  assertEquals(await txTable.count(), 1n);
});

test("Can retrieve transaction", async (txTable) => {
  await txTable.add(sampleTransactions[0]);

  assertEquals(await txTable.all(), [{ ...sampleTransactions[0], txId: 1 }]);
});
