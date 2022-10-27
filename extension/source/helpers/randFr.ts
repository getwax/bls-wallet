import * as mcl from 'mcl-wasm';
import { hexlify, randomBytes } from 'ethers/lib/utils';

export default function randFr(): mcl.Fr {
  const r = hexlify(randomBytes(12));
  const fr = new mcl.Fr();
  fr.setHashOf(r);
  return fr;
}
