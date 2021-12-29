import { assert, assertEquals, BlsWalletWrapper, ethers } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("should connect wallet", async (fx) => {
  const wallet = await BlsWalletWrapper.connect(
    fx.rng.seed("blsPrivateKey").address(),
    fx.networkConfig.addresses.verificationGateway,
    fx.adminWallet.provider,
  );

  assert(wallet.address !== ethers.constants.AddressZero);
});

Fixture.test(
  "should regenerate same wallet when registering the same key",
  async (fx) => {
    const firstWallet = await BlsWalletWrapper.connect(
      fx.rng.seed("blsPrivateKey").address(),
      fx.networkConfig.addresses.verificationGateway,
      fx.adminWallet.provider,
    );

    const secondWallet = await BlsWalletWrapper.connect(
      fx.rng.seed("blsPrivateKey").address(),
      fx.networkConfig.addresses.verificationGateway,
      fx.adminWallet.provider,
    );

    assertEquals(firstWallet.address, secondWallet.address);
  },
);
