import { assertEquals, BigNumber } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("zero fee estimate from default test config", async (fx) => {
  const [wallet] = await fx.setupWallets(1);

  const bundle = wallet.sign({
    nonce: await wallet.Nonce(),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [wallet.address, 3],
        ),
      },
    ],
  });

  const feeEstimation = await fx.aggregationStrategy.estimateFee(bundle);

  assertEquals(feeEstimation, {
    feeDetected: BigNumber.from(0),
    feeRequired: BigNumber.from(0),
    successes: [true],
  });
});
