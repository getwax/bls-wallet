import { expect } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";
import blsKeyHash from "./helpers/blsKeyHash.ts";

Deno.test({
  name: "should register new wallet",
  sanitizeOps: false,
  fn: async () => {
    const fx = await Fixture.create("should register new wallet");

    const blsSigner = await fx.BlsSigner();
    const blsWallet = await fx.BlsWallet(blsSigner);

    expect(
      await blsWallet.publicKeyHash(),
    ).toBe(
      blsKeyHash(blsSigner),
    );
  },
});
