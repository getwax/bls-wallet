import nil from "../../src/helpers/nil.ts";

type Encoder = {
  encode(data: string): string | nil;
  decode(encodedData: string): string;
};

export default class MultiEncoder {
  encoders: {
    id: number;
    encoder: Encoder;
  }[] = [];

  register(id: number, encoder: Encoder) {
    this.encoders.push({ id, encoder });
  }
}
