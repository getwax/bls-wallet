import { expect } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";
import blsKeyHash from "./helpers/blsKeyHash.ts";

Fixture.test("should register new wallet", async (fx) => {
  const blsSigner = await fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  expect(
    await blsWallet.publicKeyHash(),
  ).toBe(
    blsKeyHash(blsSigner),
  );
});

Fixture.test(
  "should regenerate same wallet when registering the same address",
  async (fx) => {
    const firstWallet = await fx.getOrCreateBlsWallet(
      await fx.createBlsSigner(),
    );
    const secondWallet = await fx.getOrCreateBlsWallet(
      await fx.createBlsSigner(),
    );

    expect(
      await firstWallet.publicKeyHash(),
    ).toBe(
      await secondWallet.publicKeyHash(),
    );
  },
);
