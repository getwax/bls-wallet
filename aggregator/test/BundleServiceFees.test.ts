import {
  assertBundleSucceeds,
  assertEquals,
  BigNumber,
  BlsWalletWrapper,
  ethers,
  Operation,
} from "./deps.ts";
import Fixture, {
  aggregationStrategyDefaultTestConfig,
  bundleServiceDefaultTestConfig,
} from "./helpers/Fixture.ts";

const oneToken = ethers.utils.parseUnits("1.0", 18);

async function createBundleService(
  fx: Fixture,
  feesOverride?: typeof aggregationStrategyDefaultTestConfig["fees"],
) {
  return await fx.createBundleService(
    {
      ...bundleServiceDefaultTestConfig,
      maxAggregationSize: 24,
    },
    {
      ...aggregationStrategyDefaultTestConfig,
      maxAggregationSize: 24,
      fees: feesOverride ?? {
        type: "token",
        address: fx.testErc20.address,
        allowLosses: true,
        breakevenOperationCount: 4.5,
        ethValueInTokens: 1300,
      },
    },
  );
}

function approveAndSendTokensToOrigin(
  fx: Fixture,
  nonce: BigNumber,
  amount: BigNumber,
): Operation {
  const es = fx.ethereumService;

  return {
    nonce,
    actions: [
      {
        ethValue: 0,
        contractAddress: fx.testErc20.address,
        encodedFunction: fx.testErc20.interface.encodeFunctionData(
          "approve",
          [es.utilities.address, amount],
        ),
      },
      {
        ethValue: 0,
        contractAddress: es.utilities.address,
        encodedFunction: es.utilities.interface.encodeFunctionData(
          "sendTokenToTxOrigin",
          [fx.testErc20.address, amount],
        ),
      },
    ],
  };
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

  assertBundleSucceeds(await bundleService.add(bundle));

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

Fixture.test("submits bundle with sufficient token fee", async (fx) => {
  const bundleService = await createBundleService(fx);

  const [wallet] = await fx.setupWallets(1, {
    tokenBalance: oneToken,
  });

  const bundle = wallet.sign(
    approveAndSendTokensToOrigin(fx, await wallet.Nonce(), oneToken),
  );

  assertBundleSucceeds(await bundleService.add(bundle));

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

Fixture.test("submits bundle with sufficient eth fee", async (fx) => {
  const bundleService = await createBundleService(fx, {
    type: "ether",
    allowLosses: true,
    breakevenOperationCount: 4.5,
  });

  const fee = BigNumber.from(2_000_000); // wei

  const [wallet] = await fx.setupWallets(1, { tokenBalance: 0 });

  await (await fx.adminWallet.sendTransaction({
    to: wallet.address,
    value: fee,
  })).wait();

  const es = fx.ethereumService;

  const bundle = wallet.sign({
    nonce: await wallet.Nonce(),
    actions: [
      {
        ethValue: fee,
        contractAddress: es.utilities.address,
        encodedFunction: es.utilities.interface.encodeFunctionData(
          "sendEthToTxOrigin",
        ),
      },
    ],
  });

  assertBundleSucceeds(await bundleService.add(bundle));

  assertEquals(
    await fx.adminWallet.provider.getBalance(wallet.address),
    fee,
  );

  assertEquals(await bundleService.bundleTable.count(), 1n);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  assertEquals(await bundleService.bundleTable.count(), 0n);

  assertEquals(
    await fx.adminWallet.provider.getBalance(wallet.address),
    BigNumber.from(0),
  );
});

Fixture.test("submits 9/10 bundles when 7th has insufficient fee", async (fx) => {
  const bundleService = await createBundleService(fx);

  const [wallet1, wallet2] = await fx.setupWallets(2, {
    tokenBalance: oneToken.mul(10),
  });

  const nonce1 = await wallet1.Nonce();
  const nonce2 = await wallet2.Nonce();

  async function addBundle(
    wallet: BlsWalletWrapper,
    nonce: BigNumber,
    fee: BigNumber,
  ) {
    const bundle = wallet.sign(
      approveAndSendTokensToOrigin(fx, nonce, fee),
    );

    assertBundleSucceeds(await bundleService.add(bundle));
  }

  // 6 good bundles from wallet 1 (each pays one token)
  await addBundle(wallet1, nonce1.add(0), oneToken);
  await addBundle(wallet1, nonce1.add(1), oneToken);
  await addBundle(wallet1, nonce1.add(2), oneToken);
  await addBundle(wallet1, nonce1.add(3), oneToken);
  await addBundle(wallet1, nonce1.add(4), oneToken);
  await addBundle(wallet1, nonce1.add(5), oneToken);

  // 7th bundle should fail because 1 wei is an insufficient fee
  await addBundle(wallet1, nonce1.add(6), BigNumber.from(1));

  // 3 more good bundles. These are from a different wallet so that the nonces
  // can be correct independent of the success/failure of bundle #7 above.
  await addBundle(wallet2, nonce2.add(0), oneToken);
  await addBundle(wallet2, nonce2.add(1), oneToken);
  await addBundle(wallet2, nonce2.add(2), oneToken);

  assertEquals(await bundleService.bundleTable.count(), 10n);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  assertEquals(await bundleService.bundleTable.count(), 1n);

  assertEquals(
    await fx.testErc20.balanceOf(wallet1.address),
    oneToken.mul(4), // 6 tokens spent from wallet 1
  );

  assertEquals(
    await fx.testErc20.balanceOf(wallet2.address),
    oneToken.mul(7), // 3 tokens spent from wallet 2
  );
});
