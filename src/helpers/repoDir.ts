import assert from "./assert.ts";
import SourceDir from "./SourceDir.ts";

const sourceDir = await SourceDir(import.meta.url);

const suffix = "/src/helpers";

assert(sourceDir.endsWith(suffix));

const repoDir = sourceDir.slice(0, sourceDir.length - suffix.length);

export default repoDir;
