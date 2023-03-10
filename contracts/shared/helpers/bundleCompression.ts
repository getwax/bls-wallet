import { ethers, BigNumber, BigNumberish } from "ethers";
import { PublicKey, Operation, Signature } from "../../clients/src";

export function bundleCompressedOperations(
  compressedOperations: string[],
  signature: Signature,
) {
  return hexJoin([
    encodeVLQ(compressedOperations.length),
    ...compressedOperations,
    ethers.utils.defaultAbiCoder.encode(["uint256[2]"], [signature]),
  ]);
}

export function compressAsFallback(
  fallbackExpanderIndex: number,
  blsPublicKey: PublicKey,
  operation: Operation,
): string {
  const result: string[] = [];

  result.push(encodeVLQ(fallbackExpanderIndex));

  const resultIndexForRegUsageBitStream = result.length;
  const regUsageBitStream: boolean[] = [];
  result.push("0x"); // Placeholder to overwrite

  regUsageBitStream.push(false);
  result.push(
    ethers.utils.defaultAbiCoder.encode(["uint256[4]"], [blsPublicKey]),
  );

  result.push(encodeVLQ(operation.nonce));
  result.push(encodePseudoFloat(operation.gas));

  result.push(encodeVLQ(operation.actions.length));

  for (const action of operation.actions) {
    result.push(encodePseudoFloat(action.ethValue));
    regUsageBitStream.push(false);
    result.push(action.contractAddress);

    const fnHex = ethers.utils.hexlify(action.encodedFunction);
    const fnLen = (fnHex.length - 2) / 2;

    result.push(encodeVLQ(fnLen));
    result.push(fnHex);
  }

  result[resultIndexForRegUsageBitStream] = encodeBitStream(regUsageBitStream);

  return hexJoin(result);
}

function hexJoin(hexStrings: string[]) {
  return "0x" + hexStrings.map(remove0x).join("");
}

function remove0x(hexString: string) {
  if (!hexString.startsWith("0x")) {
    throw new Error("Expected 0x prefix");
  }

  return hexString.slice(2);
}

export function encodeVLQ(x: BigNumberish) {
  x = BigNumber.from(x);

  const segments: number[] = [];

  while (true) {
    const segment = x.mod(128);
    segments.unshift(segment.toNumber());
    x = x.sub(segment);
    x = x.div(128);

    if (x.eq(0)) {
      break;
    }
  }

  let result = "0x";

  for (let i = 0; i < segments.length; i++) {
    const keepGoing = i !== segments.length - 1;

    const byte = (keepGoing ? 128 : 0) + segments[i];
    result += byte.toString(16).padStart(2, "0");
  }

  return result;
}

export function encodePseudoFloat(x: BigNumberish) {
  x = BigNumber.from(x);

  if (x.eq(0)) {
    return "0x00";
  }

  let exponent = 0;

  while (x.mod(10).eq(0) && exponent < 30) {
    x = x.div(10);
    exponent++;
  }

  const exponentBits = (exponent + 1).toString(2).padStart(5, "0");
  const lowest3Bits = x.mod(8).toNumber().toString(2).padStart(3, "0");

  const firstByte = parseInt(`${exponentBits}${lowest3Bits}`, 2)
    .toString(16)
    .padStart(2, "0");

  return hexJoin([`0x${firstByte}`, encodeVLQ(x.div(8))]);
}

export function encodeRegIndex(regIndex: BigNumberish) {
  regIndex = BigNumber.from(regIndex);

  const vlqValue = regIndex.div(0x010000);
  const fixedValue = regIndex.mod(0x010000).toNumber();

  return hexJoin([
    encodeVLQ(vlqValue),
    `0x${fixedValue.toString(16).padStart(4, "0")}`,
  ]);
}

/**
 * Bit streams are just the bits of a uint256 encoded as a VLQ.
 * (Technically the encoding is unbounded, but 256 booleans is a lot and it's
 * much easier to just decode the VLQ into a uint256 in the EVM.)
 *
 * Notably, the bits are little endian - the first bit is the *lowest* bit. This
 * is because the lowest bit is clearly the 1-valued bit, but the highest valued
 * bit could be anywhere - there's infinitely many zero-bits to choose from.
 *
 * If it wasn't for this need to be little endian, we'd definitely use big
 * endian (like our other encodings generally do), since that's preferred by the
 * EVM and the ecosystem:
 *
 * ```ts
 * const abi = new ethers.utils.AbiCoder():
 * console.log(abi.encode(["uint"], [0xff]));
 * // 0x00000000000000000000000000000000000000000000000000000000000000ff
 *
 * // If Ethereum used little endian (like x86), it would instead be:
 * // 0xff00000000000000000000000000000000000000000000000000000000000000
 * ```
 */
export function encodeBitStream(bitStream: boolean[]) {
  let stream = 0;
  let bitValue = 1;

  const abi = new ethers.utils.AbiCoder();
  abi.encode(["uint"], [0xff]);

  for (const bit of bitStream) {
    if (bit) {
      stream += bitValue;
    }

    bitValue *= 2;
  }

  const streamVLQ = encodeVLQ(stream);

  return streamVLQ;
}
