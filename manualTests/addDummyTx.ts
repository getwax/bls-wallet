import Client from "../src/app/Client.ts";
import * as env from "../src/app/env.ts";
import Range from "../src/helpers/Range.ts";

const client = new Client(`http://localhost:${env.PORT}`);

function dummyHex(length: number) {
  return `0x${
    Range(length).map((i) => (i % 10).toString().padStart(2, "0")).join("")
  }`;
}

const failures = await client.addTransaction({
  pubKey: dummyHex(128),
  nonce: 1,
  signature: dummyHex(64),
  tokenRewardAmount: dummyHex(32),
  contractAddress: dummyHex(20),
  methodId: dummyHex(4),
  encodedParams: dummyHex(7),
});

console.log({ failures });
