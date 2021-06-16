import { ethers, hubbleBls } from "../../deps/index.ts";

import Rng from "./Rng.ts";
import ovmContractABIs from "../../ovmContractABIs/index.ts";
import createBLSWallet from "./createBLSWallet.ts";
import WalletService from "../../src/app/WalletService.ts";
import TxTable, { TransactionData } from "../../src/app/TxTable.ts";
import dataPayload from "./dataPayload.ts";
import TxService from "../../src/app/TxService.ts";

const { BlsSignerFactory } = hubbleBls.signer;

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
    const rng = Rng.root.child(testName);

    const walletService = new WalletService(rng.address("aggregatorSigner"));

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

  private constructor(
    public testName: string,
    public rng: Rng,
    public chainId: number,
    public walletService: WalletService,
  ) {}

  async createBlsSigner(...extraSeeds: string[]) {
    const factory = await BlsSignerFactory.new();
    return factory.getSigner(
      DOMAIN,
      this.rng.address("blsSigner", ...extraSeeds),
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
    nonceOffset = 0,
  }: {
    blsSigner: hubbleBls.signer.BlsSigner;
    contract: ethers.Contract;
    method: string;
    args: string[];
    nonceOffset?: number;
  }): Promise<TransactionData> {
    const blsWallet = await this.getOrCreateBlsWallet(blsSigner);
    const encodedFunction = contract.interface.encodeFunctionData(method, args);
    const nonce = Number(await blsWallet.nonce()) + nonceOffset;

    const message = dataPayload(
      this.chainId,
      nonce,
      0,
      contract.address,
      encodedFunction,
    );

    const signature = blsSigner.sign(message);

    return {
      pubKey: hubbleBls.mcl.dumpG2(blsSigner.pubkey),
      nonce,
      signature: hubbleBls.mcl.dumpG1(signature),
      contractAddress: contract.address,
      methodId: encodedFunction.slice(0, 10),
      encodedParams: `0x${encodedFunction.slice(10)}`,
    };
  }

  async createTxService() {
    const suffix = this.rng.address("table-name-suffix").slice(2, 12);
    const tableName = `txs_test_${suffix}`;
    const txTable = await TxTable.create(tableName);

    this.cleanupJobs.push(async () => {
      await txTable.drop();
      await txTable.stop();
    });

    return new TxService(txTable, this.walletService);
  }

  async cleanup() {
    for (const job of this.cleanupJobs) {
      await job();
    }
  }
}
