import { BigNumber } from "../../../deps.ts";
import assert from "../../../src/helpers/assert.ts";
import nil from "../../../src/helpers/nil.ts";
import ByteStream from "../ByteStream.ts";
import { Encoder } from "../MultiEncoder.ts";
import PseudoFloat from "../PseudoFloat.ts";
import VLQ from "../VLQ.ts";
import { getDataWords, hexJoin } from "../util.ts";

export default class FallbackEncoder implements Encoder {
  encode(data: string): string {
    const len = data.length / 2 - 1;

    if ((data.length / 2 - 1) % 32 !== 4) {
      return hexJoin([
        VLQ.encode(2 * len),
        data,
      ]);
    }

    const res: string[] = [];

    const words = getDataWords(`0x${data.slice(10)}`);
    res.push(VLQ.encode(2 * words.length + 1));

    res.push(data.slice(0, 10));

    for (const word of words) {
      let encoding = hexJoin(["0x00", word]);

      const altEncodings = [
        hexJoin(["0x01", VLQ.encode(word)]),
        hexJoin(["0x02", PseudoFloat.encode(word)]),
        word.startsWith("0x000000000000000000000000")
          ? hexJoin(["0x03", `0x${word.slice(26)}`])
          : nil,
      ];

      for (const altEncoding of altEncodings) {
        if (altEncoding === nil) {
          continue;
        }

        if (altEncoding.length < encoding.length) {
          encoding = altEncoding;
        }
      }

      res.push(encoding);
    }

    return hexJoin(res);
  }

  decode(encodedData: string): string {
    const stream = new ByteStream(encodedData);

    const leadingVlq = VLQ.decode(stream);

    if (leadingVlq.mod(2).eq(0)) {
      const len = leadingVlq.div(2);
      return stream.getN(len.toNumber());
    }

    const wordLen = leadingVlq.div(2).toNumber();

    const methodId = stream.getN(4);

    const words: string[] = [];

    for (let i = 0; i < wordLen; i++) {
      const typeId = stream.get();

      switch (typeId) {
        case 0: {
          words.push(stream.getN(32));
          break;
        }

        case 1: {
          words.push(bigNumberToWord(VLQ.decode(stream)));
          break;
        }

        case 2: {
          words.push(bigNumberToWord(PseudoFloat.decode(stream)));
          break;
        }

        case 3: {
          words.push(`0x000000000000000000000000${stream.getN(20).slice(2)}`);
          break;
        }

        default:
          assert(false, `Unrecognized typeId ${typeId}`);
      }
    }

    return hexJoin([
      methodId,
      ...words,
    ]);
  }
}

function bigNumberToWord(x: BigNumber) {
  return "0x" + x.toHexString().slice(2).padStart(64, "0");
}
