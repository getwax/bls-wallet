import { BigNumber, BlsWallet, ethers, TransactionData } from "../../deps.ts";

import testRng from "./testRng.ts";
import WalletService from "../../src/app/WalletService.ts";
import TxTable, { TxTableRow } from "../../src/app/TxTable.ts";
import TxService from "../../src/app/TxService.ts";
import createQueryClient from "../../src/app/createQueryClient.ts";
import Range from "../../src/helpers/Range.ts";
import Mutex from "../../src/helpers/Mutex.ts";
import TestClock from "./TestClock.ts";
import * as env from "../env.ts";
import AdminWallet from "../../src/chain/AdminWallet.ts";
import AppEvent from "../../src/app/AppEvent.ts";
import MockErc20 from "./MockErc20.ts";
import nil, { isNotNil } from "../../src/helpers/nil.ts";

// deno-lint-ignore no-explicit-any
type ExplicitAny = any;

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
    const rng = testRng.seed(testName);

    const walletService = await WalletService.create(
      (evt) => fx.emit(evt),
      env.PRIVATE_KEY_AGG,
    );

    const chainId =
      (await walletService.aggregatorSigner.provider.getNetwork()).chainId;

    const fx: Fixture = new Fixture(
      testName,
      rng,
      chainId,
      walletService,
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

  testErc20: MockErc20;
  rewardErc20: MockErc20;
  adminWallet: ethers.Wallet;

  private constructor(
    public testName: string,
    public rng: typeof testRng,
    public chainId: number,
    public walletService: WalletService,
  ) {
    this.testErc20 = new MockErc20(
      env.TEST_TOKEN_ADDRESS,
      this.walletService.aggregatorSigner,
    );

    this.rewardErc20 = new MockErc20(
      env.REWARD_TOKEN_ADDRESS,
      this.walletService.aggregatorSigner,
    );

    this.adminWallet = AdminWallet(
      this.walletService.aggregatorSigner.provider,
      env.PRIVATE_KEY_ADMIN,
    );
  }

  createBlsPrivateKey(...extraSeeds: string[]) {
    return this.rng.seed("blsPrivateKey", ...extraSeeds).address();
  }

  async createTxService(config = TxService.defaultConfig) {
    const suffix = this.rng.seed("table-name-suffix").address().slice(2, 12);
    const queryClient = createQueryClient(this.emit);

    const txTablesMutex = new Mutex();

    const tableName = `txs_test_${suffix}`;
    const txTable = await TxTable.createFresh(queryClient, tableName);

    const futureTableName = `future_txs_test_${suffix}`;
    const futureTxTable = await TxTable.createFresh(
      queryClient,
      futureTableName,
    );

    this.cleanupJobs.push(async () => {
      await txTable.drop();
      await futureTxTable.drop();
      await queryClient.disconnect();
    });

    return new TxService(
      this.emit,
      this.clock,
      queryClient,
      txTablesMutex,
      txTable,
      futureTxTable,
      this.walletService,
      config,
    );
  }

  async allTxs(
    txService: TxService,
  ): Promise<{ ready: TransactionData[]; future: TransactionData[] }> {
    const removeId = (tx: TxTableRow) => {
      delete tx.txId;
      return tx;
    };

    return {
      ready: (await txService.readyTxTable.all()).map(removeId),
      future: (await txService.futureTxTable.all()).map(removeId),
    };
  }

  /**
   * Sets up wallets for testing. These wallets are also given 1000 test and
   * reward tokens.
   */
  async setupWallets(count: number, ...extraSeeds: string[]) {
    const wallets = [];
    const tokens = [this.testErc20, this.rewardErc20];

    // Unfortunately attempting to parallelize these causes duplicate nonce
    // issues. This might be mitigated by collecting `TransactionResponse`s in a
    // serial way but then awaiting .wait() in parallel. That's a significant
    // refactor though that I'm avoiding right now.
    for (const i of Range(count)) {
      const wallet = await BlsWallet.connectOrCreate(
        this.createBlsPrivateKey(`${i}`, ...extraSeeds),
        env.VERIFICATION_GATEWAY_ADDRESS,
        this.adminWallet,
      );

      const txs = await Promise.all(tokens.map(async (token, i) => {
        const balance = await token.balanceOf(wallet.address);

        // When seeding tests, we can generate wallets from previous tests, and
        // this can cause unexpected balances if we blindly mint instead of
        // doing this top-up.
        const topUp = BigNumber.from(1000).sub(balance);

        if (topUp.gt(0)) {
          return wallet.sign({
            contract: token.contract,
            method: "mint",
            args: [wallet.address, topUp.toString()],
            nonce: (await wallet.Nonce()).add(i),
          });
        }

        if (topUp.lt(0)) {
          return wallet.sign({
            contract: token.contract,
            method: "transfer",
            args: [this.adminWallet.address, topUp.mul(-1).toString()],
            nonce: (await wallet.Nonce()).add(i),
          });
        }

        return nil;
      }));

      const filteredTxs = txs.filter(isNotNil);

      if (filteredTxs.length > 0) {
        await this.walletService.sendTxs(filteredTxs);
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
    `\n  innermost error: ${currError.message}` +
      `\n\n  error: ${error.message}`,
  );

  (wrappedError as ExplicitAny).error = error;

  return wrappedError;
}
