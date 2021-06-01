// deno-lint-ignore no-explicit-any
type ExplicitAny = any;

async function readFileJson(path: string): Promise<ExplicitAny> {
  return JSON.parse(new TextDecoder().decode(await Deno.readFile(path)));
}

const prefix = "file://";

if (!import.meta.url.startsWith(prefix)) {
  throw new Error(`Not supported: non-file url: ${import.meta.url}`);
}

const dir = import.meta.url.slice(prefix.length).replace(/\/[^\/]*$/, "");

const abis: Record<string, ExplicitAny> = {};

for await (const entry of Deno.readDir(dir)) {
  if (entry.isFile && entry.name !== "mod.ts") {
    abis[entry.name] = await readFileJson(`${dir}/${entry.name}`);
  }
}

export default abis;
