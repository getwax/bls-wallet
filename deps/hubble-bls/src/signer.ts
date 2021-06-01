import { NullSigner } from "./exceptions.ts";
import {
  aggregateRaw,
  Domain,
  g1ToHex,
  g2ToHex,
  getPubkey,
  hashToPoint,
  init,
  parseFr,
  parseG1,
  parseG2,
  PublicKey,
  randFr,
  SecretKey,
  sign,
  solG1,
  solG2,
  verifyMultipleRaw,
  verifyRaw,
} from "./mcl.ts";

export interface BlsSignerInterface {
  pubkey: solG2;
  sign(message: string): solG1;
  verify(signature: solG1, pubkey: solG2, message: string): boolean;
  verifyMultiple(
    aggSignature: solG1,
    pubkeys: solG2[],
    messages: string[],
  ): boolean;
}

// Useful when your real signer is not loaded but need a placeholder
export class NullBlsSinger implements BlsSignerInterface {
  get pubkey(): solG2 {
    throw new NullSigner("NullSinger has no public key");
  }
  sign(_message: string): solG1 {
    throw new NullSigner("NullSinger dosen't sign");
  }
  verify(_signature: solG1, _pubkey: solG2, _message: string): boolean {
    throw new NullSigner("NullSinger dosen't verify");
  }
  verifyMultiple(
    _aggSignature: solG1,
    _pubkeys: solG2[],
    _messages: string[],
  ): boolean {
    throw new NullSigner("NullSinger dosen't verify");
  }
}

export const nullBlsSigner = new NullBlsSinger();

export class BlsVerifier {
  constructor(public domain: Domain) {}
  public verify(signature: solG1, pubkey: solG2, message: string) {
    const signatureG1 = parseG1(signature);
    const pubkeyG2 = parseG2(pubkey);
    const messagePoint = hashToPoint(message, this.domain);
    return verifyRaw(signatureG1, pubkeyG2, messagePoint);
  }
  public verifyMultiple(
    aggSignature: solG1,
    pubkeys: solG2[],
    messages: string[],
  ) {
    const signatureG1 = parseG1(aggSignature);
    const pubkeyG2s = pubkeys.map(parseG2);
    const messagePoints = messages.map((m) => hashToPoint(m, this.domain));
    return verifyMultipleRaw(signatureG1, pubkeyG2s, messagePoints);
  }
}

export class BlsSignerFactory {
  static async new() {
    await init();
    return new BlsSignerFactory();
  }
  private constructor() {}

  public getSigner(domain: Domain, secretHex?: string) {
    const secret = secretHex ? parseFr(secretHex) : randFr();
    return new BlsSigner(domain, secret);
  }
}

class BlsSigner extends BlsVerifier implements BlsSignerInterface {
  private _pubkey: PublicKey;
  constructor(public domain: Domain, private secret: SecretKey) {
    super(domain);
    this._pubkey = getPubkey(secret);
  }
  get pubkey(): solG2 {
    return g2ToHex(this._pubkey);
  }

  public sign(message: string): solG1 {
    const { signature } = sign(message, this.secret, this.domain);
    return g1ToHex(signature);
  }
}

export function aggregate(signatures: solG1[]): solG1 {
  const signatureG1s = signatures.map((s) => parseG1(s));
  const aggregated = aggregateRaw(signatureG1s);
  return g1ToHex(aggregated);
}
