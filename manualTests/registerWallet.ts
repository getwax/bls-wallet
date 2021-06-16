import { ethers, hubbleBls } from "../deps/index.ts";

import * as env from "../src/app/env.ts";
import ovmContractABIs from "../ovmContractABIs/index.ts";
import createBLSWallet from "../test/helpers/createBLSWallet.ts";
import blsKeyHash from "../test/helpers/blsKeyHash.ts";

const { BlsSignerFactory } = hubbleBls.signer;

const utils = ethers.utils;

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = utils.arrayify(DOMAIN_HEX);

const provider = new ethers.providers.JsonRpcProvider();
const aggregatorSigner = new ethers.Wallet(env.PRIVATE_KEY_AGG, provider);

if (env.USE_TEST_NET) {
  const originalPopulateTransaction = aggregatorSigner.populateTransaction.bind(
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
  ovmContractABIs["VerificationGateway.json"].abi,
  aggregatorSigner,
);

const blsSigner = (await BlsSignerFactory.new()).getSigner(
  DOMAIN,
  env.PRIVATE_KEY_AGG,
);

const walletAddress = await createBLSWallet(
  chainId,
  verificationGateway,
  blsSigner,
);

const blsWallet = new ethers.Contract(
  walletAddress,
  ovmContractABIs["BLSWallet.json"].abi,
  aggregatorSigner,
);

console.log(await blsWallet.publicKeyHash());
console.log("should be");
console.log(blsKeyHash(blsSigner));
