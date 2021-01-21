import { BigNumber, Signer, Contract } from "ethers";
import { contractOptions } from "web3/eth/contract";

const ethers = require("hardhat").ethers;
// const  = env.ethers;
const utils = ethers.utils;

import * as mcl from "../lib/hubble-contracts/ts/mcl";
import { keyPair } from "../lib/hubble-contracts/ts/mcl";
import { randHex, randFs, to32Hex } from "../lib/hubble-contracts/ts/utils";
import { randomBytes, hexlify, arrayify } from "ethers/lib/utils";
import { expandMsg, hashToField } from "../lib/hubble-contracts/ts/hashToField";

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);

const g2PointOnIncorrectSubgroup = [
  "0x1ef4bf0d452e71f1fb23948695fa0a87a10f3d9dce9d32fadb94711f22566fb5",
  "0x237536b6a72ac2e447e7b34a684a81d8e63929a4d670ce1541730a7e03c3f0f2",
  "0x0a63f14620a64dd39394b6e89c48679d3f2ce0c46a1ef052ee3df0bd66c198cb",
  "0x0fe4020ece1b2849af46d308e9f201ac58230a45e124997f52c65d28fe3cf8f1"
];

class Wallet {



}

const wallet = new Wallet();
export default wallet;
