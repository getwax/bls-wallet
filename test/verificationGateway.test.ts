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

  const BlsSigner = async (...extraSeeds: string[]) => {
    const factory = await BlsSignerFactory.new();
    return factory.getSigner(DOMAIN, rng.address("blsSigner", ...extraSeeds));
  };

  const BlsWallet = async (signer: hubbleBls.signer.BlsSigner) => {
    const address = await createBLSWallet(
      chainId,
      verificationGateway,
      signer,
    );

    return new ethers.Contract(
      address,
      contractABIs["BLSWallet.ovm.json"].abi,
      aggregatorSigner,
    );
  };

  return {
    rng,
    chainId,
    verificationGateway,
    aggregatorSigner,
    BlsSigner,
    BlsWallet,
  };
}

Deno.test({
  name: "should register new wallet",
  sanitizeOps: false,
  fn: async () => {
    const fx = await Fixture("should register new wallet");

    const blsSigner = await fx.BlsSigner();
    const blsWallet = await fx.BlsWallet(blsSigner);

    expect(
      await blsWallet.publicKeyHash(),
    ).toBe(
      blsKeyHash(blsSigner),
    );
  },
});
