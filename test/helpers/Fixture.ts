import { blsSignerFactory, ethers, hubbleBls } from "../../deps/index.ts";

import testRng from "./testRng.ts";
import ovmContractABIs from "../../ovmContractABIs/index.ts";
import createBLSWallet from "../../src/chain/createBLSWallet.ts";
import WalletService from "../../src/app/WalletService.ts";
import TxTable, { TransactionData } from "../../src/app/TxTable.ts";
import dataPayload from "../../src/chain/dataPayload.ts";
import TxService from "../../src/app/TxService.ts";
import createQueryClient from "../../src/app/createQueryClient.ts";
import Range from "../../src/helpers/Range.ts";
import Mutex from "../../src/helpers/Mutex.ts";
import TestClock from "./TestClock.ts";
import * as env from "../env.ts";
import AdminWallet from "../../src/chain/AdminWallet.ts";
import AppEvent from "../../src/app/AppEvent.ts";
import MockErc20 from "./MockErc20.ts";
import { assert } from "../deps.ts";
import nil, { isNotNil } from "../../src/helpers/nil.ts";

const DOMAIN_HEX = ethers.utils.keccak256("0xfeedbee5");
const DOMAIN = ethers.utils.arrayify(DOMAIN_HEX);

// deno-lint-ignore no-explicit-any
type ExplicitAny = any;

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

export default class Fixture {
  static test(
    name: string,
    fn: (fx: Fixture) => Promise<void>,
  ) {
    Deno.test({
      name,
      sanitizeOps: false,
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
      rng.seed("aggregatorSigner").address(),
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

    this.adminWallet = AdminWallet(
      this.walletService.aggregatorSigner.provider,
      this.rng.seed("admin-wallet").address(),
    );
  }

  createBlsSigner(...extraSeeds: string[]) {
    return blsSignerFactory.getSigner(
      DOMAIN,
      this.rng.seed("blsSigner", ...extraSeeds).address(),
    );
  }

  async getOrCreateBlsWalletAddress(signer: hubbleBls.signer.BlsSigner) {
    const verificationGateway = new ethers.Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs["VerificationGateway.json"].abi,
      this.adminWallet,
    );

    return await createBLSWallet(
      this.chainId,
      verificationGateway,
      signer,
    );
  }

  connectBlsWallet(address: string) {
    return new ethers.Contract(
      address,
      ovmContractABIs["BLSWallet.json"].abi,
      this.walletService.aggregatorSigner,
    );
  }

  async getOrCreateBlsWallet(signer: hubbleBls.signer.BlsSigner) {
    return this.connectBlsWallet(
      await this.getOrCreateBlsWalletAddress(signer),
    );
  }

  async createTxData({
    blsSigner,
    contract,
    method,
    args,
    tokenRewardAmount = ethers.BigNumber.from(0),
    nonceOffset = 0,
  }: {
    blsSigner: hubbleBls.signer.BlsSigner;
    contract: ethers.Contract;
    method: string;
    args: string[];
    tokenRewardAmount?: ethers.BigNumber;
    nonceOffset?: number;
  }): Promise<TransactionData> {
    const blsWallet = await this.getOrCreateBlsWallet(blsSigner);
    const encodedFunction = contract.interface.encodeFunctionData(method, args);
    const nonce = Number(await blsWallet.nonce()) + nonceOffset;

    const message = dataPayload(
      this.chainId,
      nonce,
      tokenRewardAmount.toNumber(),
      contract.address,
      encodedFunction,
    );

    const signature = blsSigner.sign(message);

    let tokenRewardAmountStr = tokenRewardAmount.toHexString();

    tokenRewardAmountStr = `0x${
      tokenRewardAmountStr.slice(2).padStart(64, "0")
    }`;

    return {
      pubKey: hubbleBls.mcl.dumpG2(blsSigner.pubkey),
      nonce,
      signature: hubbleBls.mcl.dumpG1(signature),
      tokenRewardAmount: tokenRewardAmountStr,
      contractAddress: contract.address,
      methodId: encodedFunction.slice(0, 10),
      encodedParams: `0x${encodedFunction.slice(10)}`,
    };
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
    return {
      ready: await txService.readyTxTable.all(),
      future: await txService.futureTxTable.all(),
    };
  }

  /**
   * Sets up wallets for testing. These wallets are also given 1000 test and
   * reward tokens.
   */
  async setupWallets(count: number, ...extraSeeds: string[]) {
    const wallets = [];

    const tokens = [
      this.testErc20,
      new MockErc20(
        this.walletService.rewardErc20.address,
        this.walletService.aggregatorSigner.provider,
      ),
    ];

    // Unfortunately attempting to parallelize these causes duplicate nonce
    // issues. This might be mitigated by collecting `TransactionResponse`s in a
    // serial way but then awaiting .wait() in parallel. That's a significant
    // refactor though that I'm avoiding right now.
    for (const i of Range(count)) {
      const blsSigner = this.createBlsSigner(`${i}`, ...extraSeeds);
      const blsWallet = await this.getOrCreateBlsWallet(blsSigner);

      const txs = await Promise.all(tokens.map(async (token, i) => {
        const balance = await token.balanceOf(blsWallet.address);

        // When seeding tests, we can generate wallets from previous tests, and
        // this can cause unexpected balances if we blindly mint instead of
        // doing this top-up.
        const topUp = ethers.BigNumber.from(1000).sub(balance);

        if (topUp.gt(0)) {
          return await this.createTxData({
            blsSigner,
            contract: token.contract,
            method: "mint",
            args: [blsWallet.address, topUp.toString()],
            nonceOffset: i,
          });
        }

        if (topUp.lt(0)) {
          return await this.createTxData({
            blsSigner,
            contract: token.contract,
            method: "transfer",
            args: [this.adminWallet.address, topUp.mul(-1).toString()],
            nonceOffset: i,
          });
        }

        return nil;
      }));

      await this.walletService.sendTxs(txs.filter(isNotNil));

      wallets.push({ blsSigner, blsWallet });
    }

    return wallets;
  }

  async cleanup() {
    for (const job of this.cleanupJobs) {
      await job();
    }
  }
}
