import * as shell from "./shell.ts";
import { allFiles } from "./git.ts";

// TODO (merge-ok) Consider turning this into a standard eslint rule
export async function lintTodosFixmes(): Promise<void> { // merge-ok
  const searchArgs = [
    "egrep",
    "--color",
    "-ni",
    "todo|fixme", // merge-ok
    ...(await allFiles()),
  ];

  const matches = await shell.Lines(...searchArgs);

  const notOkMatches = matches.filter((m) => !m.includes("merge-ok"));

  if (notOkMatches.length > 0) {
    console.error(notOkMatches.join("\n"));
    throw new Error(`${notOkMatches.length} todos/fixmes found`); // merge-ok
  }
}
