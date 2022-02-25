import Range from "../src/helpers/Range.ts";
import {
  assertEquals,
  BigNumber,
  BlsWalletWrapper,
  ethers,
  Operation,
} from "./deps.ts";
import Fixture, { bundleServiceDefaultTestConfig } from "./helpers/Fixture.ts";

const oneToken = ethers.utils.parseUnits("1.0", 18);

async function createBundleService(
  fx: Fixture,
  feesOverride?: Partial<typeof bundleServiceDefaultTestConfig["fees"]>,
) {
  return await fx.createBundleService({
    ...bundleServiceDefaultTestConfig,
    maxAggregationSize: 24,
    fees: {
      type: `token:${fx.testErc20.address}`,
      perGas: BigNumber.from(10_000_000_000),
      perByte: BigNumber.from(100_000_000_000_000),
      ...feesOverride,
    },
  });
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

  const bundle = wallet.sign(
    approveAndSendTokensToOrigin(fx, await wallet.Nonce(), oneToken),
  );

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

    const failures = await bundleService.add(bundle);
    assertEquals(failures, []);
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

Fixture.test("submits 9/10 bundles when 7th has insufficient gas-based fee", async (fx) => {
  const bundleService = await createBundleService(fx, {
    // This test is targeting the logic which needs to run when the
    // calldata-based gas shortcut doesn't work. We just set the per byte fee to
    // zero to make that clear.
    perByte: BigNumber.from(0),
  });

  const baseFee = BigNumber.from(1_000_000).mul(1e9); // Note 1
  const fee = BigNumber.from(1_950_000).mul(1e9);

  const [wallet1, wallet2] = await fx.setupWallets(2, {
    tokenBalance: fee.mul(10),
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

    const failures = await bundleService.add(bundle);
    assertEquals(failures, []);
  }

  // 6 good bundles from wallet 1 (each pays one token)
  await addBundle(wallet1, nonce1.add(0), fee.add(baseFee)); // Note 1
  await addBundle(wallet1, nonce1.add(1), fee);
  await addBundle(wallet1, nonce1.add(2), fee);
  await addBundle(wallet1, nonce1.add(3), fee);
  await addBundle(wallet1, nonce1.add(4), fee);
  await addBundle(wallet1, nonce1.add(5), fee);

  // Note 1: The first bundle has a base fee added because there's an overhead
  // of doing a bundle. This is a bit unrealistic but it makes the test less
  // brittle.

  // 7th bundle should fail because 1 wei is an insufficient fee
  await addBundle(wallet1, nonce1.add(6), BigNumber.from(1));

  // 3 more good bundles. These are from a different wallet so that the nonces
  // can be correct independent of the success/failure of bundle #7 above.
  await addBundle(wallet2, nonce2.add(0), fee);
  await addBundle(wallet2, nonce2.add(1), fee);
  await addBundle(wallet2, nonce2.add(2), fee);

  assertEquals(await bundleService.bundleTable.count(), 10n);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  assertEquals(await bundleService.bundleTable.count(), 1n);

  assertEquals(
    await fx.testErc20.balanceOf(wallet1.address),
    fee.mul(4).sub(baseFee), // 6 fees spent from wallet 1
  );

  assertEquals(
    await fx.testErc20.balanceOf(wallet2.address),
    fee.mul(7), // 3 fees spent from wallet 2
  );
});

Fixture.test("submits 1/3 bundles when bundle#3 fails the shortcut fee test but bundle#2 also fails the full fee test", async (fx) => {
  const bundleService = await createBundleService(fx, {
    perGas: BigNumber.from(100_000_000_000),
  });

  const [wallet] = await fx.setupWallets(2, {
    tokenBalance: oneToken.mul(10),
  });

  const nonce = await wallet.Nonce();

  const bundleFees = [
    // Passes
    BigNumber.from(140_000_000).mul(1e9),

    // Passes shortcut test but fails full test
    BigNumber.from(80_000_000).mul(1e9),

    // Fails shortcut test
    BigNumber.from(1),
  ];

  for (const i of Range(bundleFees.length)) {
    const bundle = wallet.sign(
      approveAndSendTokensToOrigin(fx, nonce.add(i), bundleFees[i]),
    );

    const failures = await bundleService.add(bundle);
    assertEquals(failures, []);
  }

  assertEquals(await bundleService.bundleTable.count(), 3n);

  fx.clock.advance(5000);
  await bundleService.submissionTimer.waitForCompletedSubmissions(1);
  await bundleService.waitForConfirmations();

  assertEquals(await bundleService.bundleTable.count(), 2n);

  assertEquals(
    await fx.testErc20.balanceOf(wallet.address),
    oneToken.mul(10).sub(bundleFees[0]),
  );
});
