import * as shell from "./shell.ts";

export async function allFiles() {
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
