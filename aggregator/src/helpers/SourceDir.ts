export default async function SourceDir(importMetaUrl: string) {
  const prefix = "file://";

  if (!importMetaUrl.startsWith(prefix)) {
    throw new Error(`Not supported: non-file url: ${importMetaUrl}`);
  }

  const dir = importMetaUrl.slice(prefix.length).replace(/\/[^\/]*$/, "");

  return await Deno.realPath(dir);
}
