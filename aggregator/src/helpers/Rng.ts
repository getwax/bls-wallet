import { BigNumber, keccak256 } from "../../deps.ts";

import words from "./words.ts";

function byteToHex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

function hash(data: string) {
  const byteValues = Array.from(new TextEncoder().encode(data));
  const hex = `0x${byteValues.map(byteToHex).join("")}`;

  return keccak256(hex);
}

export default class Rng {
  private constructor(public seeds: string[]) {}

  static root = new Rng([]);

  #hash() {
    return hash(this.seeds.map(hash).join(":"));
  }

  seed(...moreSeeds: string[]) {
    return new Rng([...this.seeds, ...moreSeeds]);
  }

  address() {
    return this.seed("address").#hash();
  }

  uint32() {
    const hash = this.seed("uint32").#hash();

    return BigNumber.from(hash).mod(2 ** 32).toNumber();
  }

  Sequence<T>(extract: (rng: Rng) => T): () => T {
    let i = 0;

    return () => {
      const rng = this.seed((i++).toString());
      return extract(rng);
    };
  }

  shuffle<T>(values: T[]) {
    const rngSeq = this.seed("shuffle").Sequence((rng) => rng.uint32());

    values = values.slice();

    for (let i = 0; i < values.length - 1; i++) {
      const j = i + (rngSeq() % (values.length - i));
      [values[i], values[j]] = [values[j], values[i]];
    }

    return values;
  }

  static generateSeed(): string {
    const randWords: string[] = [];

    for (let i = 0; i < 4; i++) {
      randWords.push(words[Math.floor(Math.random() * words.length)]);
    }

    const randSeed = randWords.join(" ");

    return randSeed;
  }
}
