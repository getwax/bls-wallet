import { encode } from 'bs58check';

export default function RandomId() {
  return encode(Buffer.from(crypto.getRandomValues(new Uint8Array(16))));
}
