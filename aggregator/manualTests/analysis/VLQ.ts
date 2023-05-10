import { BigNumber, BigNumberish } from "../../deps.ts";
import ByteStream from "./ByteStream.ts";

// deno-lint-ignore no-namespace
namespace VLQ {
  export function encode(x: BigNumberish) {
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

  export function decode(stream: ByteStream) {
    let value = BigNumber.from(0);

    while (true) {
      const currentByte = stream.get();

      // Add the lowest 7 bits to the value
      value = value.add(currentByte & 0x7f);

      // If the highest bit is zero, stop
      if ((currentByte & 0x80) === 0) {
        break;
      }

      // We're continuing. Shift the value 7 bits to the left (higher) to
      // make room.
      value = value.shl(7);
    }

    return value;
  }
}

export default VLQ;
