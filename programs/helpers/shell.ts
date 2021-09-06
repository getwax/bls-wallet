export async function run(...cmd: string[]): Promise<void> {
  const process = Deno.run({ cmd, stdout: "inherit", stderr: "inherit" });

  const unloadListener = () => {
    console.log("Sending SIGINT to", cmd);
    process.kill(Deno.Signal.SIGINT);
  };

  globalThis.addEventListener("unload", unloadListener);

  const status = await process.status();

  globalThis.removeEventListener("unload", unloadListener);

  if (!status.success) {
    throw new Error(
      `Command: "${cmd.join(" ")}" exited with code ${status.code}`,
    );
  }
}

export async function String(...cmd: string[]): Promise<string> {
  const process = Deno.run({ cmd, stdout: "piped" });

  if (process.stdout === null) {
    throw new Error("I don't know why this would happen");
  }

  const text = new TextDecoder().decode(await process.output());
  const status = await process.status();

  if (!status.success) {
    throw new Error(`Command failed: ${cmd.join(" ")}`);
  }

  return text;
}

export async function Lines(...cmd: string[]): Promise<string[]> {
  let text = await String(...cmd);

  if (text === "") {
    return [];
  }

  // Ignore trailing newline
  if (text[text.length - 1] === "\n") {
    text = text.slice(0, -1);
  }

  return text.split("\n");
}

export async function Line(...cmd: string[]): Promise<string> {
  const lines = await Lines(...cmd);

  if (lines.length !== 1) {
    throw new Error("Expected exactly one line");
  }

  return lines[0];
}
