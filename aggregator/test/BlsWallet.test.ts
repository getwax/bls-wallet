import { assertEquals, BlsWallet, keccak256 } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";
import * as env from "./env.ts";

Fixture.test("should register new wallet", async (fx) => {
  const wallet = await BlsWallet.connectOrCreate(
    fx.rng.seed("blsPrivateKey").address(),
    env.VERIFICATION_GATEWAY_ADDRESS,
    fx.adminWallet,
  );

  assertEquals(
    keccak256(wallet.blsWalletSigner.getPublicKey(wallet.privateKey)),
    wallet.blsWalletSigner.getPublicKeyHash(wallet.privateKey),
  );
});

Fixture.test(
  "should regenerate same wallet when registering the same key",
  async (fx) => {
    const firstWallet = await BlsWallet.connectOrCreate(
      fx.rng.seed("blsPrivateKey").address(),
      env.VERIFICATION_GATEWAY_ADDRESS,
      fx.adminWallet,
    );

    const secondWallet = await BlsWallet.connectOrCreate(
      fx.rng.seed("blsPrivateKey").address(),
      env.VERIFICATION_GATEWAY_ADDRESS,
      fx.adminWallet,
    );

    assertEquals(firstWallet.address, secondWallet.address);
  },
);
