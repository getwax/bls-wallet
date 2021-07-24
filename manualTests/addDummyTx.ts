import Client from "../src/app/Client.ts";
import * as env from "../src/app/env.ts";
import Range from "../src/helpers/Range.ts";

const client = new Client(`http://localhost:${env.PORT}`);

function dummyHex(length: number) {
  return `0x${
    Range(length).map((i) => (i % 100).toString().padStart(2, "0")).join("")
  }`;
}

const tx = {
  pubKey: dummyHex(128),
  nonce: 1,
  signature: dummyHex(64),
  tokenRewardAmount: dummyHex(32),
  contractAddress: dummyHex(20),
  methodId: dummyHex(4),
  encodedParams: dummyHex(7),
};

console.log("sending", tx);

const failures = await client.addTransaction(tx);

console.log({ failures });
