import Client from "../src/app/Client.ts";
import * as env from "../src/app/env.ts";

const client = new Client(`http://localhost:${env.PORT}`);

const failures = await client.addTransaction({
  pubKey: "pubKey",
  nonce: 1,
  signature: "signature",
  tokenRewardAmount: "1",
  contractAddress: "contractAddress",
  methodId: "methodId",
  encodedParams: "encodedParams",
});

console.log({ failures });
