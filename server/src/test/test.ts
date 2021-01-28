
//web2
import https from 'http';

import * as FormData from 'form-data';
import { request } from 'http';
import { createReadStream } from 'fs';

//web3
import { expect, assert } from "chai";
import { BigNumber, Signer, Contract } from "ethers";
import { arrayify, keccak256 } from "ethers/lib/utils";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import { getSigners } from "@nomiclabs/hardhat-ethers/src/helpers";
// import wallet from '../app/wallet';

//bls
import BLSWrapper from './blsWrapper';



const ACCOUNTS_LENGTH = 3;
let signers: Signer[];
let addresses: string[];
let hre: any; // TODO: import

async function main() {

  const DOMAIN_HEX = keccak256("0xfeedbee5");
  const DOMAIN = arrayify(DOMAIN_HEX);

  // signers = (await getSigners(hre)).slice(0, ACCOUNTS_LENGTH);
  // addresses = await Promise.all(signers.map(acc => acc.getAddress()));

  // let transferSigner: BLSWrapper = new BLSWrapper(
  //   arrayify(keccak256("0xfeedbee5")),
  //   "transfer",
  //   addresses
  // );

  // const response = await fetch(myUrl, {
  //   method: 'POST',
  //   body: "content",
  //   headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'} });

  // if (!response.ok) { /* Handle */ }

  // // If you care about a response:
  // if (response.body !== null) {
  //   // body is ReadableStream<Uint8Array>
  //   // parse as needed, e.g. reading directly, or
  //   const asString = new TextDecoder("utf-8").decode(response.body);
  //   // and further:
  //   const asJSON = JSON.parse(asString);  // implicitly 'any', make sure to verify type on runtime.

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET'
  }

  const req = https.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    res.on('data', d => {
      process.stdout.write(d + '\n');
    })
  })
    
  req.on('error', error => {
    console.error(error);
  })

  req.end();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });