#!/usr/bin/env -S deno run --unstable --allow-run --allow-read --allow-write

import { parseArgs } from "../deps.ts";

import * as shell from "./helpers/shell.ts";
import repoDir from "../src/helpers/repoDir.ts";
import dotEnvPath from "../src/helpers/dotEnvPath.ts";

const args = parseArgs(Deno.args);

Deno.chdir(repoDir);

const buildDir = `${repoDir}/build`;

try {
  await Deno.remove(buildDir, { recursive: true });
} catch (error) {
  if (error.name === "NotFound") {
    // We don't care that remove failed due to NotFound (why do we need to catch
    // an exception to handle this normal use case? 🤔)
  } else {
    throw error;
  }
}

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

const sudoDockerArg = args["sudo-docker"] === true ? ["sudo"] : [];

await shell.run(
  ...sudoDockerArg,
  "docker",
  "build",
  repoDir,
  "-t",
  "aggregator",
);

await shell.run(
  ...sudoDockerArg,
  "docker",
  "save",
  "--output",
  `${repoDir}/build/docker-image.tar`,
  "aggregator:latest",
);

if (sudoDockerArg.length > 0) {
  // chown to the current user
  const username = await shell.Line("whoami");

  await shell.run(
    "sudo",
    "chown",
    username,
    `${repoDir}/build/docker-image.tar`,
  );
}

await shell.run(
  "gzip",
  `${repoDir}/build/docker-image.tar`,
);

console.log("Aggregator build complete");
