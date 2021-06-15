import { ethers, hubbleBls } from "../../deps/index.ts";

import * as env from "../env.ts";
import Rng from "./Rng.ts";
import contractABIs from "../../contractABIs/index.ts";
import createBLSWallet from "./createBLSWallet.ts";

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
        try {
          await fn(await Fixture.create(name));
        } catch (error) {
          throw wrapInnermostError(error);
        }
      },
    });
  }

  static async create(testName: string): Promise<Fixture> {
    const rng = Rng.root.child(testName);

    const provider = new ethers.providers.JsonRpcProvider();

    const signerKey = rng.address("aggregatorSigner");

    const aggregatorSigner = new ethers.Wallet(signerKey, provider);

    if (env.USE_TEST_NET) {
      const originalPopulateTransaction = aggregatorSigner.populateTransaction
        .bind(
          aggregatorSigner,
        );

      aggregatorSigner.populateTransaction = (transaction) => {
        transaction.gasPrice = 0;
        return originalPopulateTransaction(transaction);
      };
    }

    const chainId = (await provider.getNetwork()).chainId;

    const verificationGateway = new ethers.Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      contractABIs["VerificationGateway.ovm.json"].abi,
      aggregatorSigner,
    );

    return new Fixture(
      testName,
      rng,
      chainId,
      verificationGateway,
      aggregatorSigner,
    );
  }

  private constructor(
    public testName: string,
    public rng: Rng,
    public chainId: number,
    public verificationGateway: ethers.Contract,
    public aggregatorSigner: ethers.Wallet,
  ) {}

  async createBlsSigner(...extraSeeds: string[]) {
    const factory = await BlsSignerFactory.new();
    return factory.getSigner(
      DOMAIN,
      this.rng.address("blsSigner", ...extraSeeds),
    );
  }

  async createBlsWalletAddress(signer: hubbleBls.signer.BlsSigner) {
    return await createBLSWallet(
      this.chainId,
      this.verificationGateway,
      signer,
    );
  }

  connectBlsWallet(address: string) {
    return new ethers.Contract(
      address,
      contractABIs["BLSWallet.ovm.json"].abi,
      this.aggregatorSigner,
    );
  }

  async createBlsWallet(signer: hubbleBls.signer.BlsSigner) {
    return this.connectBlsWallet(await this.createBlsWalletAddress(signer));
  }
}
