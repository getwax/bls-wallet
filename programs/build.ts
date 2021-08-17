#!/usr/bin/env -S deno run --unstable --allow-run --allow-read --allow-write

import { ensureDir } from "https://deno.land/std@0.103.0/fs/mod.ts";

import * as shell from "./helpers/shell.ts";
import repoDir from "../src/helpers/repoDir.ts";

await ensureDir(`${repoDir}/build`);

const outputPath = `${repoDir}/build/aggregator.js`;

await shell.run(
  "deno",
  "bundle",
  "--unstable",
  `${repoDir}/programs/aggregator.ts`,
  outputPath,
);

console.log(`Built ${outputPath} successfully`);
