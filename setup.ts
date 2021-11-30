#!/usr/bin/env -S deno run --unstable --allow-run --allow-read --allow-write

import { exists } from "https://deno.land/std@0.103.0/fs/mod.ts";
import * as shell from "./aggregator/programs/helpers/shell.ts";

const components = [
  { name: "aggregator", skipYarn: true },
  { name: "contracts" },
  { name: "contracts/clients" },
  { name: "extension" },
];

async function runYarn(name: string): Promise<void> {
  const { success } = await Deno.run({ cmd: ["yarn"], cwd: `./${name}` }).status();
  if (!success) {
    throw new Error(`yarn install failed for ${name}`);
  }
}

console.log("initializing bls-wallet repo");

console.log("initializing git submodules...");
await shell.run(..."git submodule update --init --recursive".split(" "));

console.log(`setting up components (${components.map(c => c.name).join(", ")})...`);
await Promise.all(components.map(async ({ name, skipYarn }) => {
  if (!skipYarn) {
    console.log(`yarn installing in ${name}...`);
    await runYarn(name);
  }

  const envFilePath = `./${name}/.env`;
  const envExampleFilePath = `${envFilePath}.example`;

  const [envExists, envExampleExists] = await Promise.all([
    exists(envFilePath),
    exists(envExampleFilePath)
  ]);

  if (envExists) {
    console.warn(`${envExampleFilePath} already exists`);
    return;
  }

  if (envExampleExists) {
    console.log(`copying ${envExampleFilePath} to ${envFilePath}...`);
    await Deno.copyFile(envExampleFilePath, envFilePath);
  }
}));

console.log("bls-wallet repo initializing complete");
