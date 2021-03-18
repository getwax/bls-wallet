import * as dotenv from "dotenv";
dotenv.config();

import { ethers, Wallet } from "ethers";
import { BigNumber, Signer, Contract, ContractInterface } from "ethers";

import * as mcl from "../lib/hubble-contracts/ts/mcl";
import { keyPair } from "../lib/hubble-contracts/ts/mcl";
import { randHex, randFs, to32Hex } from "../lib/hubble-contracts/ts/utils";
import { expandMsg, hashToField } from "../lib/hubble-contracts/ts/hashToField";
import { readFile, readFileSync } from "fs";
import agg from "./tx.controller";

const utils = ethers.utils;
const { randomBytes, hexlify, keccak256, arrayify } = utils;

const DOMAIN_HEX = keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);


const g2PointOnIncorrectSubgroup = [
  "0x1ef4bf0d452e71f1fb23948695fa0a87a10f3d9dce9d32fadb94711f22566fb5",
  "0x237536b6a72ac2e447e7b34a684a81d8e63929a4d670ce1541730a7e03c3f0f2",
  "0x0a63f14620a64dd39394b6e89c48679d3f2ce0c46a1ef052ee3df0bd66c198cb",
  "0x0fe4020ece1b2849af46d308e9f201ac58230a45e124997f52c65d28fe3cf8f1"
];

let erc20ABI: any;
let blsWalletABI:any;

let aggregatorSigner: Wallet;

let blsWallet: Contract;
let erc20: Contract;

namespace wallet { 

  export async function init(address: string) {
    const provider = new ethers.providers.JsonRpcProvider();
    aggregatorSigner = new ethers.Wallet(`${process.env.PRIVATE_KEY_AGG}`, provider);

    erc20ABI = JSON.parse(
      readFileSync("./contractABIs/MockERC20.json", "utf8")
    ).abi;
    blsWalletABI = JSON.parse(
      readFileSync("./contractABIs/BLSWallet.json", "utf8")
    ).abi;

  }

  export async function setContractAddresses(erc20Address: string, blsWalletAddress: string) {
    erc20 = new Contract(
      erc20Address,
      erc20ABI,
      aggregatorSigner
    );

    blsWallet = new Contract(
      blsWalletAddress,
      blsWalletABI,
      aggregatorSigner
    );
    console.log(`Set Addresses: ${erc20}, ${blsWalletAddress}`);
  }

  export async function sendTxs(txs: any[]) {
    let senders = txs.map( tx => tx.sender );
    console.log(await Promise.all(senders.map(add => erc20.balanceOf(add))));

    let recipients = txs.map( tx => tx.recipient );
    let amounts = txs.map( tx => tx.amount );
    let signatures = txs.map( tx => tx.signature );

    const aggSignature = mcl.g1ToHex(mcl.aggregateRaw(signatures));
    let tx = await blsWallet.transferBatch(
      aggSignature,
      txs.map( tx => tx.sender ),
      txs.map( tx => tx.message),
      txs.map( tx => tx.recipient ),
      txs.map( tx => tx.amount )
    );
    await tx.wait();

    console.log(await Promise.all(senders.map(add => erc20.balanceOf(add))));

  }

}

export default wallet;
