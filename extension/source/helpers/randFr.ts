import * as mcl from 'mcl-wasm';
import { hexlify, randomBytes } from 'ethers/lib/utils';

export default async function randFr(): Promise<mcl.Fr> {
  await mcl.init(mcl.BN_SNARK1);
  mcl.setMapToMode(mcl.BN254);
  const r = hexlify(randomBytes(12));
  const fr = new mcl.Fr();
  fr.setHashOf(r);
  return fr;
}
