import assert from './assert';

export default function generateRandomHex(bits: number): string {
  const byteLen = bits / 8;
  assert(byteLen === Math.round(byteLen));

  const randomBytes = Array.from(
    crypto.getRandomValues(new Uint8Array(byteLen)),
  );

  const hexBytes = randomBytes.map((byte) =>
    byte.toString(16).padStart(2, '0'),
  );

  return `0x${hexBytes.join('')}`;
}
