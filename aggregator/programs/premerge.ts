#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env

import { lintTodosFixmes } from "./helpers/lint.ts"; // merge-ok
import { checkTs } from "./helpers/typescript.ts";
import * as shell from "./helpers/shell.ts";
import repoDir from "../src/helpers/repoDir.ts";
import { envName } from "../src/helpers/dotEnvPath.ts";

Deno.chdir(repoDir);

for (const [name, run] of Checks()) {
  console.log(`\nCheck: ${name}...\n`);

  const startTime = Date.now();
  await run();
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n...completed in ${duration}s\n`);
}

type Check = [
  name: string,
  run: () => Promise<void>,
];

function Checks(): Check[] {
  return [
    ["lint", async () => {
      await shell.run("deno", "lint", ".");
    }],
    ["todos and fixmes", lintTodosFixmes], // merge-ok
    ["typescript", checkTs],
    ["test", async () => {
      await shell.run(
        "deno",
        "test",
        // Note: Tests currently need to be serial because we rely on fixed
        // accounts with funds to fuel transactions. Those accounts then can't
        // be used in parallel because the nonces on the txs won't be in sync.
        // "-j",
        "--fail-fast=3",
        "--allow-net",
        "--allow-env",
        "--allow-read",
        "--",
        "--env",
        envName,
      );
    }],
  ];
}
