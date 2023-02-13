import { allFiles } from "./git.ts";
import * as shell from "./shell.ts";
import nil from "../../src/helpers/nil.ts";
import repoDir from "../../src/helpers/repoDir.ts";

export async function checkTs(): Promise<void> {
  let testFilePath: string | nil = nil;

  try {
    const tsFiles = (await allFiles()).filter((f) => f.endsWith(".ts"));

    testFilePath = await Deno.makeTempFile({ suffix: ".ts" });

    await Deno.writeTextFile(
      testFilePath,
      tsFiles.map((f) => `import "${repoDir}/${f}";`).join("\n"),
    );

    await shell.run("deno", "check", testFilePath);
  } finally {
    if (testFilePath !== nil) {
      await Deno.remove(testFilePath);
    }
  }
}
