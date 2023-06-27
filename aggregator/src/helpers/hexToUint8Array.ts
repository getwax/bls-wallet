import assert from "./assert.ts";

export default function hexToUint8Array(hex: string) {
  assert(hex.startsWith("0x"));
  assert(hex.length % 2 === 0);

  const len = (hex.length - 2) / 2;
  const result = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    const hexPos = 2 * i + 2;
    result[i] = parseInt(hex.slice(hexPos, hexPos + 2), 16);
  }

  return result;
}
