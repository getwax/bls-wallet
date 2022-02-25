import { assertEquals, BigNumber, ethers } from "./deps.ts";
import Fixture, { bundleServiceDefaultTestConfig } from "./helpers/Fixture.ts";

const oneToken = ethers.utils.parseUnits("1.0", 18);

async function createBundleService(fx: Fixture) {
  return await fx.createBundleService({
    ...bundleServiceDefaultTestConfig,
    rewards: {
      type: `token:${fx.testErc20.address}`,
      perGas: BigNumber.from(10_000_000_000),
      perByte: BigNumber.from(100_000_000_000_000),
    },
  });
}

Fixture.test("does not submit bundle with insufficient fee", async (fx) => {
  const bundleService = await createBundleService(fx);

  const [wallet] = await fx.setupWallets(1);

  const bundle = wallet.sign({
    nonce: await wallet.Nonce(),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "mint",
          [wallet.address, 1],
        ),
      },
    ],
  });

  const failures = await bundleService.add(bundle);
  assertEquals(failures, []);

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1000),
  );
  assertEquals(await bundleService.bundleTable.count(), 1n);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1000),
  );
  assertEquals(await bundleService.bundleTable.count(), 1n);
});

Fixture.test("submits bundle with sufficient fee", async (fx) => {
  const bundleService = await createBundleService(fx);

  const [wallet] = await fx.setupWallets(1, {
    tokenBalance: oneToken,
  });

  const es = fx.ethereumService;

  const bundle = wallet.sign({
    nonce: await wallet.Nonce(),
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData("approve", [
          es.utilities.address,
          oneToken,
        ]),
      },
      {
        ethValue: 0,
        contractAddress: es.utilities.address,
        encodedFunction: es.utilities.interface.encodeFunctionData(
          "sendTokenToTxOrigin",
          [fx.testErc20.address, oneToken],
        ),
      },
    ],
  });

  const failures = await bundleService.add(bundle);
  assertEquals(failures, []);

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    oneToken,
  );

  assertEquals(await bundleService.bundleTable.count(), 1n);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  assertEquals(await bundleService.bundleTable.count(), 0n);

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(0),
  );
});
