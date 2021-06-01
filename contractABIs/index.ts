// deno-lint-ignore no-explicit-any
type ExplicitAny = any;

async function readFileJson(path: string): Promise<ExplicitAny> {
  const jsonString = new TextDecoder().decode(await Deno.readFile(path));

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    error.message = `${path}: ${error.message}`;
    throw error;
  }
}

const prefix = "file://";

if (!import.meta.url.startsWith(prefix)) {
  throw new Error(`Not supported: non-file url: ${import.meta.url}`);
}

const dir = import.meta.url.slice(prefix.length).replace(/\/[^\/]*$/, "");

const abis: Record<string, ExplicitAny> = {};

for await (const entry of Deno.readDir(dir)) {
  if (entry.isFile && entry.name !== "index.ts") {
    abis[entry.name] = await readFileJson(`${dir}/${entry.name}`);
  }
}

export default abis;
