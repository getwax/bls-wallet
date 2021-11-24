import assert from "./assert";
import Range from "./Range";

export default function splitHex256(hex: string) {
  assert(hex.slice(0, 2) === "0x");
  hex = hex.slice(2);

  if (hex.length % 64 !== 0) {
    throw new Error("hex doesn't fit evenly into 256 bit chunks");
  }

  return Range(hex.length / 64).map((i) =>
    `0x${hex.slice(64 * i, 64 * (i + 1))}`
  );
}
