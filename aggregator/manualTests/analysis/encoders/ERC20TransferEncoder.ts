import nil from "../../../src/helpers/nil.ts";
import ByteStream from "../ByteStream.ts";
import { Encoder } from "../MultiEncoder.ts";
import PseudoFloat from "../PseudoFloat.ts";
import { bigNumberToWord, hexJoin } from "../util.ts";

export default class ERC20TransferEncoder implements Encoder {
  encode(data: string): string | nil {
    const stream = new ByteStream(data);

    if (stream.bytesRemaining() !== 68 || stream.getN(4) !== "0xa9059cbb") {
      return nil;
    }

    return hexJoin([
      "0x" + stream.getN(32).slice(26),
      PseudoFloat.encode(stream.getN(32)),
    ]);
  }

  decode(encodedData: string): string {
    const stream = new ByteStream(encodedData);

    return hexJoin([
      "0xa9059cbb",
      "0x000000000000000000000000" + stream.getN(20).slice(2),
      bigNumberToWord(PseudoFloat.decode(stream)),
    ]);
  }
}
