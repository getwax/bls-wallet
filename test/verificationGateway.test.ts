import { expect } from "./deps.ts";

import { ethers, hubbleBls } from "../deps/index.ts";

import contractABIs from "../contractABIs/index.ts";

import * as env from "./env.ts";
import rootRng from "./helpers/rootRng.ts";
import createBLSWallet from "./helpers/createBLSWallet.ts";
import blsKeyHash from "./helpers/blsKeyHash.ts";

const { BlsSignerFactory } = hubbleBls.signer;

const utils = ethers.utils;

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = utils.arrayify(DOMAIN_HEX);

async function Fixture(testName: string) {
  const rng = rootRng.child(testName);

  const provider = new ethers.providers.JsonRpcProvider();

  const signerKey = rng.address("signerKey");

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

  return {
    rng,
    chainId,
    verificationGateway,
    aggregatorSigner,
  };
}

Deno.test({
  name: "should register new wallet",
  sanitizeOps: false,
  fn: async () => {
    const { rng, chainId, verificationGateway, aggregatorSigner } =
      await Fixture("should register new wallet");

    const blsSigner = (await BlsSignerFactory.new()).getSigner(
      DOMAIN,
      rng.address("blsSignerSecret"),
    );

    const walletAddress = await createBLSWallet(
      chainId,
      verificationGateway,
      blsSigner,
    );

    const blsWallet = new ethers.Contract(
      walletAddress,
      contractABIs["BLSWallet.ovm.json"].abi,
      aggregatorSigner,
    );

    expect(
      await blsWallet.publicKeyHash(),
    ).toBe(
      blsKeyHash(blsSigner),
    );
  },
});
