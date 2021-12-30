#!/usr/bin/env -S deno run --unstable --allow-run --allow-read --allow-write

import { dirname, parseArgs } from "../deps.ts";

import * as shell from "./helpers/shell.ts";
import repoDir from "../src/helpers/repoDir.ts";
import dotEnvPath, { envName } from "../src/helpers/dotEnvPath.ts";
import nil from "../src/helpers/nil.ts";

const args = parseArgs(Deno.args);

Deno.chdir(repoDir);
const buildDir = `${repoDir}/build`;

await ensureFreshBuildDir();
await buildEnvironment();
await copyTypescriptFiles();
await buildDockerImage();

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

async function shortContentHash(filePath: string) {
  const contentHash = (await shell.Line("shasum", "-a", "256", filePath));

  return contentHash.slice(0, 7);
}

async function BuildName() {
  // TODO: Make build name change when networkConfig changes

  const commitShort = (await shell.Line("git", "rev-parse", "HEAD")).slice(
    0,
    7,
  );

  const isDirty =
    (await shell.Lines("git", "status", "--porcelain")).length > 0;

  const envHashShort = await shortContentHash(`${buildDir}/.env`);

  return [
    "git",
    commitShort,
    ...(isDirty ? ["dirty"] : []),
    "env",
    envName,
    envHashShort,
  ].join("-");
}

async function ensureFreshBuildDir() {
  try {
    await Deno.remove(buildDir, { recursive: true });
  } catch (error) {
    if (error.name === "NotFound") {
      // We don't care that remove failed due to NotFound (why do we need to
      // catch an exception to handle this normal use case? 🤔)
    } else {
      throw error;
    }
  }

  await Deno.mkdir(buildDir);
}

async function buildEnvironment() {
  const repoDotEnv = await Deno.readTextFile(dotEnvPath);

  let networkConfigPaths: { repo: string; build: string } | nil = nil;
  const buildDotEnvLines: string[] = [];

  for (const line of repoDotEnv.split("\n")) {
    let buildLine = line;

    if (line.startsWith("NETWORK_CONFIG_PATH=")) {
      const repoNetworkConfigPath = line.slice(
        "NETWORK_CONFIG_PATH=".length,
      );

      const networkConfigHash = await shortContentHash(repoNetworkConfigPath);

      networkConfigPaths = {
        repo: repoNetworkConfigPath,
        build: `networkConfig-${networkConfigHash}.json`,
      };

      // Need to replace this value with a build location because otherwise
      // this file might not be included in the docker image
      buildLine = `NETWORK_CONFIG_PATH=${networkConfigPaths.build}`;
    }

    buildDotEnvLines.push(buildLine);
  }

  if (networkConfigPaths !== nil) {
    await Deno.copyFile(
      networkConfigPaths.repo,
      `${buildDir}/${networkConfigPaths.build}`,
    );
  }

  await Deno.writeTextFile(`${buildDir}/.env`, buildDotEnvLines.join("\n"));
}

async function copyTypescriptFiles() {
  for (const f of await allFiles()) {
    if (!f.endsWith(".ts")) {
      continue;
    }

    console.log("Processing", f);
    await Deno.mkdir(dirname(`${buildDir}/ts/${f}`), { recursive: true });
    await Deno.copyFile(f, `${buildDir}/ts/${f}`);
  }
}

async function buildDockerImage() {
  const buildName = await BuildName();

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
}
