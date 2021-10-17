import * as env from "../env.ts";

import Rng from "../../src/helpers/Rng.ts";

export const testSeed = (() => {
  if (env.TEST_SEED) {
    return env.TEST_SEED;
  }

  const seed = Rng.generateSeed();

  console.log(`TEST_SEED not set, using randomly generated seed: ${seed}`);

  return seed;
})();

export default Rng.root.seed(testSeed);
