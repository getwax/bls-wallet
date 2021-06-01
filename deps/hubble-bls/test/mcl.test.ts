import {
  arrayify,
  assert,
  assertEquals,
  formatBytes32String,
  keccak256,
} from "./deps.ts";

import * as mcl from "../src/mcl.ts";

// This is the raw API, it is not recommended to use it directly in your application

const DOMAIN = arrayify(keccak256("0x1234ABCD"));

Deno.test("BLS raw API - parse g1", async function () {
  await mcl.init();
  const mclG1 = mcl.randMclG1();
  assert(mcl.parseG1(mcl.g1ToHex(mclG1)).isEqual(mclG1));
});

Deno.test("BLS raw API - parse g2", async function () {
  await mcl.init();
  const mclG2 = mcl.randMclG2();
  assert(mcl.parseG2(mcl.g2ToHex(mclG2)).isEqual(mclG2));
});

Deno.test("BLS raw API - load and dumps Fr", async function () {
  await mcl.init();
  const fr = mcl.randFr();
  assert(fr.isEqual(mcl.loadFr(mcl.dumpFr(fr))));
});

Deno.test("BLS raw API - load and dumps G1", async function () {
  await mcl.init();
  const solG1 = mcl.g1ToHex(mcl.randMclG1());
  assertEquals(mcl.loadG1(mcl.dumpG1(solG1)).join(", "), solG1.join(", "));
});

Deno.test("BLS raw API - load and dumps G2", async function () {
  await mcl.init();
  const solG2 = mcl.g2ToHex(mcl.randMclG2());
  assertEquals(mcl.loadG2(mcl.dumpG2(solG2)).join(", "), solG2.join(", "));
});

Deno.test("BLS raw API - verify single signature", async function () {
  await mcl.init();
  // mcl.sign takes hex string as input, so the raw string needs to be encoded
  const message = formatBytes32String("Hello");
  const { pubkey, secret } = mcl.newKeyPair();
  const { signature, messagePoint } = mcl.sign(message, secret, DOMAIN);

  // Note that we use the message produced by mcl.sign
  assert(mcl.verifyRaw(signature, pubkey, messagePoint));

  const { pubkey: badPubkey } = mcl.newKeyPair();
  assert(!mcl.verifyRaw(signature, badPubkey, messagePoint));
});

Deno.test("BLS raw API - verify aggregated signature", async function () {
  await mcl.init();
  const rawMessages = ["Hello", "how", "are", "you"];
  const messages: mcl.MessagePoint[] = [];
  const pubkeys: mcl.PublicKey[] = [];
  const signatures: mcl.Signature[] = [];
  for (const raw of rawMessages) {
    const message = formatBytes32String(raw);
    const { pubkey, secret } = mcl.newKeyPair();
    const { signature, messagePoint } = mcl.sign(
      message,
      secret,
      DOMAIN,
    );
    messages.push(messagePoint);
    pubkeys.push(pubkey);
    signatures.push(signature);
  }
  const aggSignature = mcl.aggregateRaw(signatures);
  assert(mcl.verifyMultipleRaw(aggSignature, pubkeys, messages));
});
