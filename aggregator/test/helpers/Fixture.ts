import {
  BigNumber,
  BigNumberish,
  BlsWalletSigner,
  BlsWalletWrapper,
  ethers,
  MockERC20,
  MockERC20__factory,
  NetworkConfig,
  QueryClient,
} from "../../deps.ts";

import testRng from "./testRng.ts";
import EthereumService from "../../src/app/EthereumService.ts";
import createQueryClient from "../../src/app/createQueryClient.ts";
import Range from "../../src/helpers/Range.ts";
import Mutex from "../../src/helpers/Mutex.ts";
import TestClock from "./TestClock.ts";
import * as env from "../env.ts";
import AdminWallet from "../../src/chain/AdminWallet.ts";
import AppEvent from "../../src/app/AppEvent.ts";
import nil, { isNotNil } from "../../src/helpers/nil.ts";
import getNetworkConfig from "../../src/helpers/getNetworkConfig.ts";
import BundleService from "../../src/app/BundleService.ts";
import BundleTable, { BundleRow } from "../../src/app/BundleTable.ts";
import AggregationStrategy, {
  AggregationStrategyConfig,
} from "../../src/app/AggregationStrategy.ts";

// deno-lint-ignore no-explicit-any
type ExplicitAny = any;

let existingClient: QueryClient | nil = nil;

export const bundleServiceDefaultTestConfig:
  typeof BundleService.defaultConfig = {
    bundleQueryLimit: 100,
    maxAggregationSize: 12,
    maxAggregationDelayMillis: 5000,
    maxUnconfirmedAggregations: 3,
    maxEligibilityDelay: 300,
  };

export const aggregationStrategyDefaultTestConfig: AggregationStrategyConfig = {
  maxAggregationSize: 12,
  fees: {
    type: "ether",
    allowLosses: true,
    breakevenOperationCount: 4.5,
  },
};

export default class Fixture {
  static test(
    name: string,
    fn: (fx: Fixture) => Promise<void>,
  ) {
    Deno.test({
      name,
      sanitizeOps: false,
      sanitizeResources: false,
      fn: async () => {
        const fx = await Fixture.create(name);

        try {
          await fn(fx);
        } catch (error) {
          throw wrapInnermostError(error);
        } finally {
          await fx.cleanup();
        }
      },
    });
  }

  static async create(testName: string): Promise<Fixture> {
    const netCfg = await getNetworkConfig();
    const rng = testRng.seed(testName);

    const ethereumService = await EthereumService.create(
      (evt) => fx.emit(evt),
      netCfg.addresses.verificationGateway,
      netCfg.addresses.utilities,
      env.PRIVATE_KEY_AGG,
    );

    const chainId =
      (await ethereumService.wallet.provider.getNetwork()).chainId;

    const fx: Fixture = new Fixture(
      testName,
      rng,
      chainId,
      ethereumService,
      ethereumService.blsWalletSigner,
      new AggregationStrategy(
        ethereumService.blsWalletSigner,
        ethereumService,
        aggregationStrategyDefaultTestConfig,
      ),
      netCfg,
    );

    return fx;
  }

  appEvents: AppEvent[] = [];

  emit = (evt: AppEvent) => {
    this.appEvents.push(evt);

    if (env.TEST_LOGGING) {
      if ("data" in evt) {
        console.log(evt.type, evt.data);
      } else {
        console.log(evt.type);
      }
    }
  };

  cleanupJobs: (() => void | Promise<void>)[] = [];
  clock = new TestClock();

  testErc20: MockERC20;
  adminWallet: ethers.Wallet;

  private constructor(
    public testName: string,
    public rng: typeof testRng,
    public chainId: number,
    public ethereumService: EthereumService,
    public blsWalletSigner: BlsWalletSigner,
    public aggregationStrategy: AggregationStrategy,
    public networkConfig: NetworkConfig,
  ) {
    this.testErc20 = MockERC20__factory.connect(
      this.networkConfig.addresses.testToken,
      this.ethereumService.wallet.provider,
    );

    this.adminWallet = AdminWallet(
      this.ethereumService.wallet.provider,
      env.PRIVATE_KEY_ADMIN,
    );
  }

  createBlsPrivateKey(...extraSeeds: string[]) {
    return this.rng.seed("blsPrivateKey", ...extraSeeds).address();
  }

  async createBundleService(
    config = bundleServiceDefaultTestConfig,
    aggregationStrategyConfig = aggregationStrategyDefaultTestConfig,
  ) {
    const suffix = this.rng.seed("table-name-suffix").address().slice(2, 12);
    existingClient = createQueryClient(this.emit, existingClient);
    const queryClient = existingClient;

    const tablesMutex = new Mutex();

    const tableName = `bundles_test_${suffix}`;
    const table = await BundleTable.createFresh(queryClient, tableName);

    const aggregationStrategy = (
      aggregationStrategyConfig === aggregationStrategyDefaultTestConfig
        ? this.aggregationStrategy
        : new AggregationStrategy(
          this.blsWalletSigner,
          this.ethereumService,
          aggregationStrategyConfig,
        )
    );

    const bundleService = new BundleService(
      this.emit,
      this.clock,
      queryClient,
      tablesMutex,
      table,
      this.blsWalletSigner,
      this.ethereumService,
      aggregationStrategy,
      config,
    );

    this.cleanupJobs.push(async () => {
      await bundleService.stop();
      await table.drop();
    });

    return bundleService;
  }

  async mine(numBlocks: number): Promise<void> {
    const provider = this.ethereumService.wallet
      .provider as ethers.providers.JsonRpcProvider;
    for (let i = 0; i < numBlocks; i++) {
      await provider.send("evm_mine", []);
    }
  }

  allBundles(
    bundleService: BundleService,
  ): Promise<BundleRow[]> {
    return bundleService.bundleTable.all();
  }

  /**
   * Sets up wallets for testing. These wallets are also given test tokens.
   * (1000 wei by default.)
   */
  async setupWallets(
    count: number,
    {
      extraSeeds = [],
      tokenBalance = 1000,
    }: {
      extraSeeds?: string[];
      tokenBalance?: BigNumberish;
    } = {},
  ) {
    const wallets = [];
    const tokens = [this.testErc20];

    // Unfortunately attempting to parallelize these causes duplicate nonce
    // issues. This might be mitigated by collecting `TransactionResponse`s in a
    // serial way but then awaiting .wait() in parallel. That's a significant
    // refactor though that I'm avoiding right now.
    for (const i of Range(count)) {
      const wallet = await BlsWalletWrapper.connect(
        this.createBlsPrivateKey(`${i}`, ...extraSeeds),
        this.networkConfig.addresses.verificationGateway,
        this.adminWallet.provider,
      );

      const bundles = await Promise.all(tokens.map(async (token, i) => {
        const balance = await token.balanceOf(wallet.address);

        // When seeding tests, we can generate wallets from previous tests, and
        // this can cause unexpected balances if we blindly mint instead of
        // doing this top-up.
        const topUp = BigNumber.from(tokenBalance).sub(balance);

        if (topUp.gt(0)) {
          return wallet.sign({
            nonce: (await wallet.Nonce()).add(i),
            actions: [
              {
                ethValue: 0,
                contractAddress: token.address,
                encodedFunction: token.interface.encodeFunctionData(
                  "mint",
                  [wallet.address, topUp],
                ),
              },
            ],
          });
        }

        if (topUp.lt(0)) {
          return wallet.sign({
            nonce: (await wallet.Nonce()).add(i),
            actions: [
              {
                ethValue: 0,
                contractAddress: token.address,
                encodedFunction: token.interface.encodeFunctionData(
                  "transfer",
                  [this.adminWallet.address, topUp.mul(-1)],
                ),
              },
            ],
          });
        }

        return nil;
      }));

      const filteredBundles = bundles.filter(isNotNil);

      if (filteredBundles.length > 0) {
        await this.ethereumService.submitBundle(
          this.blsWalletSigner.aggregate(filteredBundles),
        );
      }

      wallets.push(wallet);
    }

    return wallets;
  }

  async cleanup() {
    for (const job of this.cleanupJobs) {
      await job();
    }
  }
}

function getInnerError(error: Error): Error | undefined {
  const innerError = (error as ExplicitAny).error;

  return innerError instanceof Error ? innerError : undefined;
}

function wrapInnermostError(error: Error): Error {
  let currError = error;
  let nextError = getInnerError(currError);

  while (nextError) {
    currError = nextError;
    nextError = getInnerError(currError);
  }

  if (currError === error) {
    return error;
  }

  const wrappedError = new Error(
    `\n  innermost error: ${currError.stack}` +
      `\n\n  error: ${error.message}`,
  );

  (wrappedError as ExplicitAny).error = error;

  return wrappedError;
}
