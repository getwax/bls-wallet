#!/usr/bin/env -S deno run --unstable --allow-run --allow-read --allow-write

import * as shell from "./helpers/shell.ts";
import repoDir from "../src/helpers/repoDir.ts";
import dotEnvPath from "../src/helpers/dotEnvPath.ts";

const buildDir = `${repoDir}/build`;

await Deno.remove(buildDir, { recursive: true });
await Deno.mkdir(buildDir);

await Deno.copyFile(dotEnvPath, `${buildDir}/.env`);

const outputPath = `${repoDir}/build/aggregator.js`;

await shell.run(
  "deno",
  "bundle",
  "--unstable",
  `${repoDir}/programs/aggregator.ts`,
  outputPath,
);

console.log("Aggregator build complete");
