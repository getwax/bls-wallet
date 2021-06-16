import { assertEquals } from "./deps.ts";

import TxTable, { TransactionData } from "../src/app/TxTable.ts";

let counter = 0;

function test(name: string, fn: (txTable: TxTable) => Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    fn: async () => {
      const tableName = `txs_test_${counter++}_${Date.now()}`;

      const txTable = await TxTable.create(tableName);

      try {
        await fn(txTable);
      } finally {
        await txTable.drop();
        await txTable.stop();
      }
    },
  });
}

const sampleTransactions: TransactionData[] = [
  {
    txId: 1,
    pubKey: "pubKey",
    signature: "signature",
    contractAddress: "recipient",
    methodId: "methodId",
    encodedParams: "encodedParams",
  },
];

test("Starts with zero transactions", async (txTable) => {
  assertEquals(await txTable.count(), 0n);
});

test("Has one transaction after adding transaction", async (txTable) => {
  await txTable.addTx(sampleTransactions[0]);

  assertEquals(await txTable.count(), 1n);
});

test("Can retrieve transaction", async (txTable) => {
  await txTable.addTx(sampleTransactions[0]);

  assertEquals(await txTable.getTxs(), [sampleTransactions[0]]);
});
