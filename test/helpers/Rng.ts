import { ethers } from "../../deps/index.ts";

import * as env from "../env.ts";
import words from "./words.ts";

const { keccak256 } = ethers.utils;

function hash(data: string) {
  const byteValues = Array.from(new TextEncoder().encode(data));
  const hex = `0x${byteValues.map((byte) => byte.toString(16)).join("")}`;

  return keccak256(hex);
}

const seed = (() => {
  if (env.TEST_SEED) {
    return env.TEST_SEED;
  }

  const randWords: string[] = [];

  for (let i = 0; i < 4; i++) {
    randWords.push(words[Math.floor(Math.random() * words.length)]);
  }

  const randSeed = randWords.join(" ");

  console.log(`TEST_SEED not set, using randomly generated seed: ${randSeed}`);

  return randSeed;
})();

export default class Rng {
  private constructor(private baseSeeds: string[]) {}

  static root = new Rng([seed]);

  child(...extraSeeds: string[]) {
    return new Rng([...this.baseSeeds, ...extraSeeds]);
  }

  private hashBase(extraSeeds: string[]) {
    return hash(
      [...this.baseSeeds, ...extraSeeds].map(hash).join(":"),
    );
  }

  address(...extraSeeds: string[]) {
    return this.hashBase(extraSeeds);
  }
}
