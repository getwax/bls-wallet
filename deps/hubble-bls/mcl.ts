import { BigNumber } from "@ethersproject/bignumber";
import { arrayify, hexlify, isHexString } from "@ethersproject/bytes";

import { hashToField } from "./hashToField";
import {
  BadByteLength,
  BadDomain,
  BadHex,
  BadMessage,
  EmptyArray,
  MismatchLength,
} from "./exceptions";

declare const require: (name: string) => any;
const mcl = require("../mcl-wasm");

export const FIELD_ORDER = BigNumber.from(
  "0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47",
);

// deno-lint-ignore no-explicit-any
type ExplicitAny = any;

export type mclG2 = ExplicitAny;
export type mclG1 = ExplicitAny;
export type mclFP = ExplicitAny;
export type mclFR = ExplicitAny;

export type SecretKey = mclFR;
export type MessagePoint = mclG1;
export type Signature = mclG1;
export type PublicKey = mclG2;

export type solG1 = [string, string];
export type solG2 = [string, string, string, string];

export interface keyPair {
  pubkey: PublicKey;
  secret: SecretKey;
}

export type Domain = Uint8Array;

export async function init() {
  await mcl.init(mcl.BN_SNARK1);
  mcl.setMapToMode(mcl.BN254);
}

export function validateDomain(domain: Domain) {
  if (domain.length != 32) {
    throw new BadDomain(`Expect 32 bytes but got ${domain.length}`);
  }
}

export function hashToPoint(msg: string, domain: Domain): MessagePoint {
  if (!isHexString(msg)) {
    throw new BadMessage(`Expect hex string but got ${msg}`);
  }

  const _msg = arrayify(msg);
  const [e0, e1] = hashToField(domain, _msg, 2);
  const p0 = mapToPoint(e0);
  const p1 = mapToPoint(e1);
  const p = mcl.add(p0, p1);
  p.normalize();
  return p;
}

export function mapToPoint(e0: BigNumber): mclG1 {
  const e1 = new mcl.Fp();
  e1.setStr(e0.mod(FIELD_ORDER).toString());
  return e1.mapToG1();
}

export function toBigEndian(p: mclFP): Uint8Array {
  // serialize() gets a little-endian output of Uint8Array
  // reverse() turns it into big-endian, which Solidity likes
  return p.serialize().reverse();
}

export function g1(): mclG1 {
  const g1 = new mcl.G1();
  g1.setStr("1 0x01 0x02", 16);
  return g1;
}

export function g2(): mclG2 {
  const g2 = new mcl.G2();
  g2.setStr(
    "1 0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed 0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2 0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa 0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b",
  );
  return g2;
}

export function negativeG2(): mclG2 {
  const g2 = new mcl.G2();
  g2.setStr(
    "1 0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed 0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2 0x1d9befcd05a5323e6da4d435f3b617cdb3af83285c2df711ef39c01571827f9d 0x275dc4a288d1afb3cbb1ac09187524c7db36395df7be3b99e673b13a075a65ec",
  );
  return g2;
}

export function g1ToHex(p: mclG1): solG1 {
  p.normalize();
  const x = hexlify(toBigEndian(p.getX()));
  const y = hexlify(toBigEndian(p.getY()));
  return [x, y];
}

export function g2ToHex(p: mclG2): solG2 {
  p.normalize();
  const x = toBigEndian(p.getX());
  const x0 = hexlify(x.slice(32));
  const x1 = hexlify(x.slice(0, 32));
  const y = toBigEndian(p.getY());
  const y0 = hexlify(y.slice(32));
  const y1 = hexlify(y.slice(0, 32));
  return [x0, x1, y0, y1];
}

export function getPubkey(secret: SecretKey): PublicKey {
  const pubkey = mcl.mul(g2(), secret);
  pubkey.normalize();
  return pubkey;
}

export function sign(
  message: string,
  secret: SecretKey,
  domain: Domain,
): { signature: Signature; messagePoint: MessagePoint } {
  const messagePoint = hashToPoint(message, domain);
  const signature = mcl.mul(messagePoint, secret);
  signature.normalize();
  return { signature, messagePoint };
}

export function verifyRaw(
  signature: Signature,
  pubkey: PublicKey,
  message: MessagePoint,
): boolean {
  const negG2 = new mcl.PrecomputedG2(negativeG2());

  const pairings = mcl.precomputedMillerLoop2mixed(
    message,
    pubkey,
    signature,
    negG2,
  );
  return mcl.finalExp(pairings).isOne();
}

export function verifyMultipleRaw(
  aggSignature: Signature,
  pubkeys: PublicKey[],
  messages: MessagePoint[],
): boolean {
  const size = pubkeys.length;
  if (size === 0) throw new EmptyArray("number of public key is zero");
  if (size != messages.length) {
    throw new MismatchLength(
      `public keys ${size}; messages ${messages.length}`,
    );
  }
  const negG2 = new mcl.PrecomputedG2(negativeG2());
  let accumulator = mcl.precomputedMillerLoop(aggSignature, negG2);
  for (let i = 0; i < size; i++) {
    accumulator = mcl.mul(
      accumulator,
      mcl.millerLoop(messages[i], pubkeys[i]),
    );
  }
  return mcl.finalExp(accumulator).isOne();
}

export function aggregateRaw(signatures: Signature[]): Signature {
  let aggregated = new mcl.G1();
  for (const sig of signatures) {
    aggregated = mcl.add(aggregated, sig);
  }
  aggregated.normalize();
  return aggregated;
}

export function parseFr(hex: string) {
  if (!isHexString(hex)) throw new BadHex(`Expect hex but got ${hex}`);
  const fr = new mcl.Fr();
  fr.setHashOf(hex);
  return fr;
}

export function parseG1(solG1: solG1): mclG1 {
  const g1 = new mcl.G1();
  const [x, y] = solG1;
  g1.setStr(`1 ${x} ${y}`, 16);
  return g1;
}

export function parseG2(solG2: solG2): mclG2 {
  const g2 = new mcl.G2();
  const [x0, x1, y0, y1] = solG2;
  g2.setStr(`1 ${x0} ${x1} ${y0} ${y1}`);
  return g2;
}

export function dumpFr(fr: mclFR): string {
  return `0x${fr.serializeToHexStr()}`;
}

export function loadFr(hex: string): mclFR {
  const fr = new mcl.Fr();
  fr.deserializeHexStr(hex.slice(2));
  return fr;
}

export function dumpG1(solG1: solG1): string {
  const [x, y] = solG1;
  return `0x${x.slice(2)}${y.slice(2)}`;
}

export function dumpG2(solG2: solG2): string {
  const [x0, x1, y0, y1] = solG2;
  return `0x${x0.slice(2)}${x1.slice(2)}${y0.slice(2)}${y1.slice(2)}`;
}

export function loadG1(hex: string): solG1 {
  const bytesarray = arrayify(hex);
  if (bytesarray.length != 64) {
    throw new BadByteLength(
      `Expect length 64 but got ${bytesarray.length}`,
    );
  }
  const x = hexlify(bytesarray.slice(0, 32));
  const y = hexlify(bytesarray.slice(32));
  return [x, y];
}

export function loadG2(hex: string): solG2 {
  const bytesarray = arrayify(hex);
  if (bytesarray.length != 128) {
    throw new BadByteLength(
      `Expect length 128 but got ${bytesarray.length}`,
    );
  }
  const x0 = hexlify(bytesarray.slice(0, 32));
  const x1 = hexlify(bytesarray.slice(32, 64));
  const y0 = hexlify(bytesarray.slice(64, 96));
  const y1 = hexlify(bytesarray.slice(96, 128));
  return [x0, x1, y0, y1];
}

export const getMclInstance = () => mcl;
