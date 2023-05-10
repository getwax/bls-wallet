import assert from "../../src/helpers/assert.ts";
import nil from "../../src/helpers/nil.ts";
import ByteStream from "./ByteStream.ts";
import VLQ from "./VLQ.ts";
import { hexJoin } from "./util.ts";

export type Encoder = {
  encode(data: string): string | nil;
  decode(encodedData: string): string;
};

export default class MultiEncoder {
  encoders: {
    id: number;
    encoder: Encoder;
  }[] = [];

  encodersById: Record<number, Encoder> = {};

  register(id: number, encoder: Encoder) {
    assert(id !== 0);
    this.encoders.push({ id, encoder });
    this.encodersById[id] = encoder;
  }

  encode(data: string): string {
    for (const { id, encoder } of this.encoders) {
      const encoded = encoder.encode(data);

      if (encoded === nil) {
        continue;
      }

      return hexJoin([
        VLQ.encode(id),
        encoded,
      ]);
    }

    return hexJoin([
      VLQ.encode(0),
      VLQ.encode(data.length / 2 - 1),
      data,
    ]);
  }

  decode(data: string): string {
    const stream = new ByteStream(data);
    const id = VLQ.decode(stream);

    if (id.eq(0)) {
      const len = VLQ.decode(stream);
      return stream.getN(len.toNumber());
    }

    const encoder = this.encodersById[id.toNumber()];
    assert(encoder !== nil);

    return encoder.decode(stream.getTail());
  }
}
