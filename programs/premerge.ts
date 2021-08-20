#!/usr/bin/env -S deno run --unstable --allow-run --allow-read --allow-write

import * as shell from "./helpers/shell.ts";
import repoDir from "../src/helpers/repoDir.ts";
import nil from "../src/helpers/nil.ts";
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
    ["typescript", async () => {
      let testFilePath: string | nil = nil;

      try {
        const tsFiles = [
          ...await shell.Lines("git", "ls-files"),
          ...await shell.Lines(
            "git",
            "ls-files",
            "--others",
            "--exclude-standard",
          ),
        ].filter((f) => f.endsWith(".ts"));

        testFilePath = await Deno.makeTempFile({ suffix: ".ts" });

        await Deno.writeTextFile(
          testFilePath,
          tsFiles.map((f) => `import "${repoDir}/${f}";`).join("\n"),
        );

        await shell.run("deno", "cache", "--unstable", testFilePath);
      } finally {
        if (testFilePath !== nil) {
          await Deno.remove(testFilePath);
        }
      }
    }],
    ["test", async () => {
      await shell.run(
        "deno",
        "test",
        "-j",
        "--allow-net",
        "--allow-env",
        "--allow-read",
        "--unstable",
        "--",
        "--env",
        envName,
      );
    }],
  ];
}
