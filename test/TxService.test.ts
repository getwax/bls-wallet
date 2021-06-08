import { assertEquals } from "./deps.ts";

import TxService from "../src/app/TxService.ts";

let counter = 0;

function test(name: string, fn: (txService: TxService) => Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    fn: async () => {
      const tableName = `txs_test_${counter++}_${Date.now()}`;

      const txService = await TxService.create(tableName);

      try {
        await fn(txService);
      } finally {
        await txService.drop();
        await txService.stop();
      }
    },
  });
}

test("Starts with zero transactions", async (txService) => {
  assertEquals(await txService.txCount(), 0n);
});
