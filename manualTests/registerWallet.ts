import { blsSignerFactory, ethers } from "../deps/index.ts";

import * as env from "../src/env.ts";
import ovmContractABIs from "../ovmContractABIs/index.ts";
import createBLSWallet from "../src/chain/createBLSWallet.ts";
import blsKeyHash from "../src/chain/blsKeyHash.ts";

const utils = ethers.utils;

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = utils.arrayify(DOMAIN_HEX);

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
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

const blsSigner = blsSignerFactory.getSigner(
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
