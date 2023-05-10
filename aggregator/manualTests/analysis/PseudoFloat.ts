import { BigNumber, BigNumberish } from "../../deps.ts";
import ByteStream from "./ByteStream.ts";
import VLQ from "./VLQ.ts";
import { hexJoin } from "./util.ts";

// deno-lint-ignore no-namespace
namespace PseudoFloat {
  export function encode(x: BigNumberish) {
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

    return hexJoin([`0x${firstByte}`, VLQ.encode(x.div(8))]);
  }

  export function decode(stream: ByteStream) {
    const firstByte = stream.get();

    if (firstByte == 0) {
      return BigNumber.from(0);
    }

    const exponent = ((firstByte & 0xf8) >> 3) - 1;

    let mantissa = VLQ.decode(stream);

    mantissa = mantissa.shl(3);
    mantissa = mantissa.add(firstByte & 0x07);

    return mantissa.mul(BigNumber.from(10).pow(exponent));
  }
}

export default PseudoFloat;
