import { blsSignerFactory, ethers, hubbleBls } from "../../deps/index.ts";

import Rng from "./Rng.ts";
import ovmContractABIs from "../../ovmContractABIs/index.ts";
import createBLSWallet from "./createBLSWallet.ts";
import WalletService from "../../src/app/WalletService.ts";
import TxTable, { TransactionData } from "../../src/app/TxTable.ts";
import dataPayload from "./dataPayload.ts";
import TxService from "../../src/app/TxService.ts";
import createQueryClient from "../../src/app/createQueryClient.ts";
import Range from "../../src/helpers/Range.ts";
import Mutex from "../../src/helpers/Mutex.ts";
import TestClock from "./TestClock.ts";

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
    const rng = Rng.root.seed(testName);

    const walletService = new WalletService(
      rng.seed("aggregatorSigner").address(),
    );

    const chainId =
      (await walletService.aggregatorSigner.provider.getNetwork()).chainId;

    return new Fixture(
      testName,
      rng,
      chainId,
      walletService,
    );
  }

  cleanupJobs: (() => void | Promise<void>)[] = [];
  clock = new TestClock();

  private constructor(
    public testName: string,
    public rng: Rng,
    public chainId: number,
    public walletService: WalletService,
  ) {}

  createBlsSigner(...extraSeeds: string[]) {
    return blsSignerFactory.getSigner(
      DOMAIN,
      this.rng.seed("blsSigner", ...extraSeeds).address(),
    );
  }

  async getOrCreateBlsWalletAddress(signer: hubbleBls.signer.BlsSigner) {
    return await createBLSWallet(
      this.chainId,
      this.walletService.verificationGateway,
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

    return {
      pubKey: hubbleBls.mcl.dumpG2(blsSigner.pubkey),
      nonce,
      signature: hubbleBls.mcl.dumpG1(signature),
      tokenRewardAmount: tokenRewardAmount.toString(),
      contractAddress: contract.address,
      methodId: encodedFunction.slice(0, 10),
      encodedParams: `0x${encodedFunction.slice(10)}`,
    };
  }

  async createTxService(config = TxService.defaultConfig) {
    const suffix = this.rng.seed("table-name-suffix").address().slice(2, 12);
    const queryClient = createQueryClient();

    const txTablesMutex = new Mutex();

    const tableName = `txs_test_${suffix}`;
    const txTable = await TxTable.create(queryClient, tableName);

    const futureTableName = `future_txs_test_${suffix}`;
    const futureTxTable = await TxTable.create(queryClient, futureTableName);

    this.cleanupJobs.push(async () => {
      await txTable.drop();
      await queryClient.disconnect();
    });

    return new TxService(
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

    // Unfortunately attempting to parallelize these causes duplicate nonce
    // issues. This might be mitigated by collecting `TransactionResponse`s in a
    // serial way but then awaiting .wait() in parallel. That's a significant
    // refactor though that I'm avoiding right now.
    for (const i of Range(count)) {
      const blsSigner = this.createBlsSigner(`${i}`, ...extraSeeds);
      const blsWallet = await this.getOrCreateBlsWallet(blsSigner);

      await this.walletService.sendTxs([
        await this.createTxData({
          blsSigner,
          contract: this.walletService.erc20,
          method: "mint",
          args: [blsWallet.address, "1000"],
          nonceOffset: 0,
        }),
        await this.createTxData({
          blsSigner,
          contract: this.walletService.rewardErc20,
          method: "mint",
          args: [blsWallet.address, "1000"],
          nonceOffset: 1,
        }),
      ]);

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
