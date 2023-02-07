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

function createBundleService(
  fx: Fixture,
  feesOverride?: typeof aggregationStrategyDefaultTestConfig["fees"],
) {
  return fx.createBundleService(
    bundleServiceDefaultTestConfig,
    {
      ...aggregationStrategyDefaultTestConfig,
      maxGasPerBundle: 3000000,
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
  const bundleService = createBundleService(fx);

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
  assertEquals(await bundleService.bundleTable.count(), 1);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(1000),
  );
  assertEquals(await bundleService.bundleTable.count(), 1);
});

Fixture.test("submits bundle with sufficient token fee", async (fx) => {
  const bundleService = createBundleService(fx);

  const [wallet] = await fx.setupWallets(1, {
    tokenBalance: oneToken,
  });

  const bundle = wallet.sign(
    approveAndSendTokensToOrigin(fx, await wallet.Nonce(), oneToken),
  );

  const bundleResponse = await bundleService.add(bundle);
  assertBundleSucceeds(bundleResponse);

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    oneToken,
  );

  assertEquals(await bundleService.bundleTable.count(), 1);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  if ("failures" in bundleResponse) {
    throw new Error("Bundle failed to be created");
  }
  const bundleRow = await bundleService.bundleTable.findBundle(
    bundleResponse.hash,
  );

  assertEquals(bundleRow?.status, "confirmed");
  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    BigNumber.from(0),
  );
});

Fixture.test("submits bundle with sufficient eth fee", async (fx) => {
  const es = fx.ethereumService;

  const bundleService = createBundleService(fx, {
    type: "ether",
    allowLosses: true,
    breakevenOperationCount: 4.5,
  });

  const [wallet] = await fx.setupWallets(1, { tokenBalance: 0 });
  const nonce = await wallet.Nonce();

  await (await fx.adminWallet.sendTransaction({
    to: wallet.address,
    value: 1,
  })).wait();

  const estimation = await bundleService.aggregationStrategy.estimateFee(
    wallet.sign({
      nonce,
      actions: [
        {
          ethValue: 1,
          contractAddress: es.utilities.address,
          encodedFunction: es.utilities.interface.encodeFunctionData(
            "sendEthToTxOrigin",
          ),
        },
      ],
    }),
  );

  assertEquals(estimation.successes, [true]);

  const fee = estimation.feeRequired
    .add(estimation.feeRequired.div(5)); // +20% safety margin

  await (await fx.adminWallet.sendTransaction({
    to: wallet.address,
    value: fee
      .sub(1), // Already sent 1 wei before
  })).wait();

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

  const bundleResponse = await bundleService.add(bundle);
  assertBundleSucceeds(bundleResponse);

  assertEquals(
    await fx.adminWallet.provider.getBalance(wallet.address),
    fee,
  );

  assertEquals(await bundleService.bundleTable.count(), 1);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  if ("failures" in bundleResponse) {
    throw new Error("Bundle failed to be created");
  }
  const bundleRow = await bundleService.bundleTable.findBundle(
    bundleResponse.hash,
  );

  assertEquals(bundleRow?.status, "confirmed");
  assertEquals(
    await fx.adminWallet.provider.getBalance(wallet.address),
    BigNumber.from(0),
  );
});

Fixture.test("submits 9/10 bundles when 7th has insufficient fee", async (fx) => {
  const breakevenOperationCount = 4.5;

  const bundleService = createBundleService(fx, {
    type: "token",
    address: fx.testErc20.address,
    allowLosses: true,
    breakevenOperationCount,
    ethValueInTokens: 1,
  });

  const wallets = await fx.setupWallets(10, {
    tokenBalance: oneToken.mul(10),
  });

  const nonce = await wallets[0].Nonce();

  async function addBundle(
    wallet: BlsWalletWrapper,
    fee: BigNumber,
  ) {
    const bundle = wallet.sign(
      approveAndSendTokensToOrigin(fx, nonce, fee),
    );

    assertBundleSucceeds(await bundleService.add(bundle));
  }

  // For the purposes of this test, we don't want the bundleService prematurely
  // running a submission on fewer bundles than we're trying to process
  bundleService.config.breakevenOperationCount = Infinity;

  // 6 good bundles
  await addBundle(wallets[0], oneToken);
  await addBundle(wallets[1], oneToken);
  await addBundle(wallets[2], oneToken);
  await addBundle(wallets[3], oneToken);
  await addBundle(wallets[4], oneToken);
  await addBundle(wallets[5], oneToken);

  // 7th bundle should fail because 1 wei is an insufficient fee
  await addBundle(wallets[6], BigNumber.from(1));

  // 3 more good bundles
  await addBundle(wallets[7], oneToken);
  await addBundle(wallets[8], oneToken);
  await addBundle(wallets[9], oneToken);

  // Restore this value now that all the bundles are added together
  bundleService.config.breakevenOperationCount = breakevenOperationCount;

  assertEquals(await bundleService.bundleTable.count(), 10);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  const remainingBundles = fx.allBundles(bundleService);
  const remainingPendingBundles = remainingBundles
    .filter((bundle) => bundle.status === "pending");

  assertEquals(remainingBundles.length, 10);
  assertEquals(remainingPendingBundles.length, 1);

  await Promise.all(wallets.map((wallet, i) =>
    (async () => {
      assertEquals(
        await fx.testErc20.balanceOf(wallet.address),
        // Every wallet should have successfully spent one token, except the 7th
        i === 6 ? oneToken.mul(10) : oneToken.mul(9),
      );
    })()
  ));
});
