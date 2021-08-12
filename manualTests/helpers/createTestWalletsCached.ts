import { exists } from "https://deno.land/std@0.102.0/fs/mod.ts";

import { ethers } from "../../deps/index.ts";

import AsyncReturnType from "../../src/helpers/AsyncReturnType.ts";
import Rng from "../../src/helpers/Rng.ts";
import { assert } from "../../test/deps.ts";
import createTestWallets from "./createTestWallets.ts";

export default async function createTestWalletsCached(
  provider: ethers.providers.Provider,
  count: number,
  seed = Rng.generateSeed(),
) {
  let testWalletResult: AsyncReturnType<typeof createTestWallets>;

  if (await exists("wallets.json")) {
    testWalletResult = JSON.parse(await Deno.readTextFile("wallets.json"));
    assert(testWalletResult.wallets.length >= count);
  } else {
    testWalletResult = await createTestWallets(provider, count, seed);
    await Deno.writeTextFile("wallets.json", JSON.stringify(testWalletResult));
  }

  return testWalletResult;
}
