import { ethers, hubbleBls } from "../deps/index.ts";

import contractABIs from "../contractABIs/index.ts";
import * as env from "../src/app/env.ts";

const { BlsSignerFactory } = hubbleBls.signer;
type BlsSignerFactory = hubbleBls.signer.BlsSignerFactory;
type BlsSignerInterface = hubbleBls.signer.BlsSignerInterface;

// deno-lint-ignore no-explicit-any
type ExplicitAny = any;

// TODO: Get the correct types from ethers
type Contract = ethers.Contract;
type ContractFactory = ethers.ContractFactory;
type Signer = ethers.Signer;

// const ethers: ExplicitAny = ethersImport;

const utils = (ethers as ExplicitAny).utils;

const { arrayify, keccak256 } = utils;

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);

const provider = new ethers.providers.JsonRpcProvider();
const aggregatorSigner = new ethers.Wallet(env.PRIVATE_KEY_AGG, provider);

// TODO: Environment variable
const testNet = true;

if (testNet) {
  const originalPopulateTransaction = aggregatorSigner.populateTransaction.bind(
    aggregatorSigner,
  );

  aggregatorSigner.populateTransaction = (transaction) => {
    transaction.gasPrice = ethers.BigNumber.from(0);
    return originalPopulateTransaction(transaction);
  };
}

const chainId: number = (await provider.getNetwork()).chainId;

let addresses: string[];

let blsSignerFactory: BlsSignerFactory;
let blsSigners: BlsSignerInterface[];

let verificationGateway: Contract;

const ACCOUNTS_LENGTH = 1;

{ // init
  addresses = [`0x${env.PRIVATE_KEY_AGG}`].slice(0, ACCOUNTS_LENGTH);

  blsSignerFactory = await BlsSignerFactory.new();
  blsSigners = addresses.map((add) => blsSignerFactory.getSigner(DOMAIN, add));

  verificationGateway = new ethers.Contract(
    env.VERIFICATION_GATEWAY_ADDRESS,
    contractABIs["VerificationGateway.json"].abi,
    aggregatorSigner,
  );
}

const blsSigner = blsSigners[0];
const walletAddress = await createBLSWallet(blsSigner);

const blsWallet = new ethers.Contract(
  walletAddress,
  contractABIs["BLSWallet.json"].abi,
  aggregatorSigner,
);

console.log(await blsWallet.publicKeyHash());
console.log("should be");
console.log(blsKeyHash(blsSigner));

// Helper functions

function blsKeyHash(blsSigner: BlsSignerInterface) {
  return keccak256(utils.solidityPack(
    ["uint256[4]"],
    [blsSigner.pubkey],
  ));
}

function dataPayload(
  nonce: ExplicitAny,
  contractAddress: ExplicitAny,
  encodedFunction: string,
) {
  const encodedFunctionHash = utils.solidityKeccak256(
    ["bytes"],
    [encodedFunction],
  );
  return utils.solidityPack(
    ["uint256", "uint256", "address", "bytes32"],
    [
      chainId,
      nonce,
      contractAddress.toString(),
      encodedFunctionHash,
    ],
  );
}

async function createBLSWallet(
  blsSigner: BlsSignerInterface,
): Promise<ExplicitAny> {
  const blsPubKeyHash = blsKeyHash(blsSigner);

  const encodedFunction = verificationGateway.interface.encodeFunctionData(
    "walletCrossCheck",
    [blsPubKeyHash],
  );

  const dataToSign = await dataPayload(
    0,
    verificationGateway.address,
    encodedFunction,
  );

  const signature = blsSigner.sign(dataToSign);

  // can be called by any ecdsa wallet
  await (await verificationGateway.blsCallCreate(
    blsSigner.pubkey,
    signature,
    verificationGateway.address,
    encodedFunction.substring(0, 10),
    "0x" + encodedFunction.substr(10),
  )).wait();

  return await verificationGateway.walletFromHash(blsPubKeyHash);
}
