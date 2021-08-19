import { expect } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("should register new wallet", async (fx) => {
  const blsSigner = fx.createBlsSigner();
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
      fx.createBlsSigner(),
    );
    const secondWallet = await fx.getOrCreateBlsWallet(
      fx.createBlsSigner(),
    );

    expect(
      await firstWallet.publicKeyHash(),
    ).toBe(
      await secondWallet.publicKeyHash(),
    );
  },
);
