import https from 'http';

import * as mcl from "../lib/hubble-contracts/ts/mcl";
import { keyPair } from "../lib/hubble-contracts/ts/mcl";
import { randHex, randFs, to32Hex } from "../lib/hubble-contracts/ts/utils";
import { randomBytes, hexlify, arrayify } from "ethers/lib/utils";
import { expandMsg, hashToField } from "../lib/hubble-contracts/ts/hashToField";

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
