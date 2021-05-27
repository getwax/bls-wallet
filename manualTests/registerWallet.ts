import { ethers } from "../deps/index.ts";

import {
  BlsSignerFactory,
  BlsSignerInterface,
} from "./lib/hubble-bls/src/signer";

// deno-lint-ignore no-explicit-any
type ExplicitAny = any;

// TODO: Get the correct types from ethers
type Contract = ExplicitAny;
type ContractFactory = ExplicitAny;
type Signer = ExplicitAny;

// const ethers: ExplicitAny = ethersImport;

const utils = (ethers as ExplicitAny).utils;

const { arrayify, keccak256 } = utils;

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);

let chainId: number;

let signers: Signer[];
let addresses: string[];

let blsSignerFactory: BlsSignerFactory;
let blsSigners: BlsSignerInterface[];

let VerificationGateway: ContractFactory;
let verificationGateway: Contract;

let BLSExpander: ContractFactory;
let blsExpander: Contract;

let BLSWallet: ContractFactory;

const ACCOUNTS_LENGTH = 5;

{ // init
  signers = (await ethers.getSigners()).slice(0, ACCOUNTS_LENGTH);
  addresses = await Promise.all(signers.map((acc) => acc.getAddress()));

  blsSignerFactory = await BlsSignerFactory.new();
  blsSigners = addresses.map((add) => blsSignerFactory.getSigner(DOMAIN, add));

  // deploy Verification Gateway
  VerificationGateway = await ethers.getContractFactory("VerificationGateway");
  verificationGateway = await VerificationGateway.deploy();
  await verificationGateway.deployed();

  BLSExpander = await ethers.getContractFactory("BLSExpander");
  blsExpander = await BLSExpander.deploy();
  await blsExpander.deployed();
  await blsExpander.initialize(verificationGateway.address);

  BLSWallet = await ethers.getContractFactory("BLSWallet");
}

const blsSigner = blsSigners[0];
const walletAddress = await createBLSWallet(blsSigner);

const blsWallet = BLSWallet.attach(walletAddress);

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

  const encodedFunction = VerificationGateway.interface.encodeFunctionData(
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
