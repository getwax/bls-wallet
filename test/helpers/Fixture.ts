import { ethers, hubbleBls } from "../../deps/index.ts";

import * as env from "../env.ts";
import Rng from "./Rng.ts";
import contractABIs from "../../contractABIs/index.ts";
import createBLSWallet from "./createBLSWallet.ts";

const { BlsSignerFactory } = hubbleBls.signer;

const DOMAIN_HEX = ethers.utils.keccak256("0xfeedbee5");
const DOMAIN = ethers.utils.arrayify(DOMAIN_HEX);

export default class Fixture {
  static test(
    name: string,
    fn: (fx: Fixture) => Promise<void>,
  ) {
    Deno.test({
      name,
      sanitizeOps: false,
      fn: async () => fn(await Fixture.create(name)),
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

  async BlsSigner(...extraSeeds: string[]) {
    const factory = await BlsSignerFactory.new();
    return factory.getSigner(
      DOMAIN,
      this.rng.address("blsSigner", ...extraSeeds),
    );
  }

  async BlsWallet(signer: hubbleBls.signer.BlsSigner) {
    const address = await createBLSWallet(
      this.chainId,
      this.verificationGateway,
      signer,
    );

    return new ethers.Contract(
      address,
      contractABIs["BLSWallet.ovm.json"].abi,
      this.aggregatorSigner,
    );
  }
}
