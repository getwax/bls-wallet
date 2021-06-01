import { arrayify, assert, formatBytes32String, keccak256 } from "./deps.ts";

import { aggregate, BlsSignerFactory } from "../src/signer.ts";

// Domain is a data that signer and verifier must agree on
// A verifier considers a signature invalid if it is signed with a different domain
const DOMAIN = arrayify(keccak256("0x1234ABCD"));

Deno.test("BLS Signer - verify single signature", async () => { // message should be a hex string
  const message = formatBytes32String("Hello");

  const factory = await BlsSignerFactory.new();

  // A signer can be instantiate with new key pair generated
  const signer = factory.getSigner(DOMAIN);
  // ... or with an existing secret
  const signer2 = factory.getSigner(DOMAIN, "0xabcd");

  const signature = signer.sign(message);

  assert(signer.verify(signature, signer.pubkey, message));
  assert(!signer.verify(signature, signer2.pubkey, message));
});

Deno.test("BLS Signer - verify aggregated signature", async () => {
  const factory = await BlsSignerFactory.new();
  const rawMessages = ["Hello", "how", "are", "you"];
  const signers = [];
  const messages = [];
  const pubkeys = [];
  const signatures = [];
  for (const raw of rawMessages) {
    const message = formatBytes32String(raw);
    const signer = factory.getSigner(DOMAIN);
    const signature = signer.sign(message);
    signers.push(signer);
    messages.push(message);
    pubkeys.push(signer.pubkey);
    signatures.push(signature);
  }
  const aggSignature = aggregate(signatures);
  assert(signers[0].verifyMultiple(aggSignature, pubkeys, messages));
});
