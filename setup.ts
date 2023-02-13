#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write

import { exists } from "https://deno.land/std@0.103.0/fs/mod.ts";
import * as shell from "./aggregator/programs/helpers/shell.ts";

/**
 * Note: This command is safe to run multiple times,
 * such as after updating from upstream main.
 */

const components = [
  { name: "aggregator", skipYarn: true },
  { name: "aggregator-proxy" },
  { name: "contracts" },
  { name: "contracts/clients" },
  { name: "extension",
    config: {
      source: "./extension/config.example.json",
      dest: "./extension/config.json"
    },
  },
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
await Promise.all(components.map(async ({ name, skipYarn, config }) => {
  if (!skipYarn) {
    console.log(`yarn installing in ${name}...`);
    await runYarn(name);
  }

  const configFilePath = config?.dest ?? `./${name}/.env`;
  const configExampleFilePath = config?.source ??`${configFilePath}.example`;

  const [envExists, envExampleExists] = await Promise.all([
    exists(configFilePath),
    exists(configExampleFilePath)
  ]);

  if (envExists) {
    console.warn(`${configExampleFilePath} already exists`);
    return;
  }

  if (envExampleExists) {
    console.log(`copying ${configExampleFilePath} to ${configFilePath}...`);
    await Deno.copyFile(configExampleFilePath, configFilePath);
  }
}));

console.log("bls-wallet repo initializing complete");
