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
        await txTable.resetTable();
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

test("Starts with zero transactions", async (txService) => {
  assertEquals(await txService.txCount(), 0n);
});

test("Has one transaction after adding transaction", async (txService) => {
  await txService.addTx(sampleTransactions[0]);

  assertEquals(await txService.txCount(), 1n);
});

test("Can retrieve transaction", async (txService) => {
  await txService.addTx(sampleTransactions[0]);

  assertEquals(await txService.getTxs(), [sampleTransactions[0]]);
});
