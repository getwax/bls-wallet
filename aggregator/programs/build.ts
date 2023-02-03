#!/usr/bin/env -S deno run --unstable --allow-run --allow-read --allow-write --allow-env

import { dirname, parseArgs } from "../deps.ts";

import * as shell from "./helpers/shell.ts";
import repoDir from "../src/helpers/repoDir.ts";

const args = parseArgs(Deno.args);

Deno.chdir(repoDir);
const buildDir = `${repoDir}/build`;

await ensureFreshBuildDir();
await copyTypescriptFiles();
await buildDockerImage();
await tarballTypescriptFiles();

console.log("\nAggregator build complete");

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

async function BuildName() {
  const commitShort = (await shell.Line("git", "rev-parse", "HEAD")).slice(
    0,
    7,
  );

  const isDirty =
    (await shell.Lines("git", "status", "--porcelain")).length > 0;

  return [
    "git",
    commitShort,
    ...(isDirty ? ["dirty"] : []),
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

async function tarballTypescriptFiles() {
  // TypeScript insists on looking inside files that aren't explicitly imported.
  // Therefore, after the build, we convert these files into a tarball so that
  // we don't interfere with the main project.

  const currDir = Deno.cwd();
  Deno.chdir(buildDir);
  await shell.run("tar", "-czf", "ts.tar.gz", "ts");
  await shell.run("rm", "-rf", "ts");
  Deno.chdir(currDir);
}

async function buildDockerImage() {
  const buildName = await BuildName();
  const imageName = `aggregator:${buildName}`;

  const sudoDockerArg = args["sudo-docker"] === true ? ["sudo"] : [];

  await shell.run(
    ...sudoDockerArg,
    "docker",
    "build",
    repoDir,
    "-t",
    imageName,
  );

  console.log("\nDocker image created:", imageName);

  if (args["image-only"]) {
    return;
  }

  const dockerImageName = `aggregator-${buildName}-docker-image`;
  const tarFilePath = `${repoDir}/build/${dockerImageName}.tar`;

  await shell.run(
    ...sudoDockerArg,
    "docker",
    "save",
    "--output",
    tarFilePath,
    `aggregator:${buildName}`,
  );

  if (sudoDockerArg.length > 0) {
    // chown to the current user
    const username = await shell.Line("whoami");

    await shell.run(
      "sudo",
      "chown",
      username,
      tarFilePath,
    );
  }

  await shell.run("gzip", tarFilePath);

  console.log(`Docker image saved: ${tarFilePath}.gz`);
}
