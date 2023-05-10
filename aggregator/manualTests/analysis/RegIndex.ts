import { BigNumber, BigNumberish } from "../../deps.ts";
import ByteStream from "./ByteStream.ts";
import VLQ from "./VLQ.ts";
import { hexJoin } from "./util.ts";

// deno-lint-ignore no-namespace
namespace RegIndex {
  export function encode(x: BigNumberish) {
    x = BigNumber.from(x);

    const vlqValue = x.div(0x10000);
    const remainder = x.mod(0x10000);

    return hexJoin([
      VLQ.encode(vlqValue),
      remainder.toNumber().toString(16).padStart(4, "0"),
    ]);
  }

  export function decode(stream: ByteStream) {
    const vlqValue = VLQ.decode(stream);
    const remainder = parseInt(stream.getTail().slice(2), 16);

    return vlqValue.mul(0x10000).add(remainder);
  }
}

export default RegIndex;
