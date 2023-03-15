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

  result.push(
    ethers.utils.defaultAbiCoder.encode(["uint256[4]"], [blsPublicKey]),
  );

  result.push(encodeVLQ(operation.nonce));
  result.push(encodePseudoFloat(operation.gas));

  result.push(encodeVLQ(operation.actions.length));

  for (const action of operation.actions) {
    result.push(encodePseudoFloat(action.ethValue));
    result.push(action.contractAddress);

    const fnHex = ethers.utils.hexlify(action.encodedFunction);
    const fnLen = (fnHex.length - 2) / 2;

    result.push(encodeVLQ(fnLen));
    result.push(fnHex);
  }

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
