import { expect } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";
import blsKeyHash from "./helpers/blsKeyHash.ts";

Fixture.test("should register new wallet", async (fx) => {
  const blsSigner = await fx.BlsSigner();
  const blsWallet = await fx.BlsWallet(blsSigner);

  expect(
    await blsWallet.publicKeyHash(),
  ).toBe(
    blsKeyHash(blsSigner),
  );
});
