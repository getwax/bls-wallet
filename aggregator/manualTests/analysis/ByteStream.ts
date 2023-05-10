import assert from "../../src/helpers/assert.ts";

export default class ByteStream {
  pos = 2;

  constructor(public data: string) {
    assert(/^0x[0-9a-fA-F]*/.test(data));
    assert(data.length % 2 === 0);
  }

  getN(len: number): string {
    const newPos = this.pos + 2 * len;
    assert(newPos <= this.data.length);

    const res = `0x${this.data.slice(this.pos, newPos)}`;
    this.pos = newPos;

    return res;
  }

  peekN(len: number) {
    const res = this.getN(len);
    this.pos -= 2 * len;

    return res;
  }

  get(): number {
    return parseInt(this.getN(1).slice(2), 16);
  }

  peek(): number {
    const res = this.get();
    this.pos -= 2;

    return res;
  }

  getTail(): string {
    const res = `0x${this.data.slice(this.pos)}`;
    this.pos = this.data.length;

    return res;
  }

  bytesRemaining() {
    return (this.data.length - this.pos) / 2;
  }
}
