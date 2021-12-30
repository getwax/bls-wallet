#!/usr/bin/env -S deno run --unstable --allow-run --allow-read --allow-write

import { dirname, parseArgs } from "../deps.ts";

import * as shell from "./helpers/shell.ts";
import repoDir from "../src/helpers/repoDir.ts";
import dotEnvPath, { envName } from "../src/helpers/dotEnvPath.ts";
import nil from "../src/helpers/nil.ts";

const args = parseArgs(Deno.args);

Deno.chdir(repoDir);

const buildDir = `${repoDir}/build`;

const commitShort = (await shell.Line("git", "rev-parse", "HEAD")).slice(0, 7);

const isDirty = (await shell.Lines("git", "status", "--porcelain")).length > 0;

const envHashShort = (await shell.Line("shasum", "-a", "256", dotEnvPath))
  .slice(0, 7);

const buildName = [
  "git",
  commitShort,
  ...(isDirty ? ["dirty"] : []),
  "env",
  envName,
  envHashShort,
].join("-");

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

const originalDotEnv = await Deno.readTextFile(dotEnvPath);

let networkConfigPath: string | nil = nil;

const dotEnv = originalDotEnv
  .split("\n")
  .map((line) => {
    if (line.startsWith("NETWORK_CONFIG_PATH=")) {
      networkConfigPath = line.slice("NETWORK_CONFIG_PATH=".length);

      // Need to replace this value with a fixed location because otherwise this
      // file won't be included in the docker image
      return "NETWORK_CONFIG_PATH=networkConfig.json";
    }

    return line;
  })
  .join("\n");

if (networkConfigPath !== nil) {
  await Deno.copyFile(networkConfigPath, `${buildDir}/networkConfig.json`);
}

await Deno.writeTextFile(`${buildDir}/.env`, dotEnv);

for (const f of await allFiles()) {
  if (!f.endsWith(".ts")) {
    continue;
  }

  console.log("Processing", f);
  await Deno.mkdir(dirname(`${buildDir}/ts/${f}`), { recursive: true });
  await Deno.copyFile(f, `${buildDir}/ts/${f}`);
}

const sudoDockerArg = args["sudo-docker"] === true ? ["sudo"] : [];

await shell.run(
  ...sudoDockerArg,
  "docker",
  "build",
  repoDir,
  "-t",
  `aggregator:${buildName}`,
);

const dockerImageName = `aggregator-${buildName}-docker-image`;

await shell.run(
  ...sudoDockerArg,
  "docker",
  "save",
  "--output",
  `${repoDir}/build/${dockerImageName}.tar`,
  `aggregator:${buildName}`,
);

if (sudoDockerArg.length > 0) {
  // chown to the current user
  const username = await shell.Line("whoami");

  await shell.run(
    "sudo",
    "chown",
    username,
    `${repoDir}/build/${dockerImageName}.tar`,
  );
}

await shell.run(
  "gzip",
  `${repoDir}/build/${dockerImageName}.tar`,
);

console.log("Aggregator build complete");

async function allFiles() {
  return [
    ...await shell.Lines("git", "ls-files"),
    ...await shell.Lines(
      "git",
      "ls-files",
      "--others",
      "--exclude-standard",
    ),
  ];
}
