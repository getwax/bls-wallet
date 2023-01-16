/* eslint-disable no-process-exit */

import { spawn } from "child_process";
import { readFile } from "fs/promises";

async function main() {
  const chainType = process.argv.includes("--hardhat") ? "hardhat" : "geth";

  const chainChild = await (chainType === "geth"
    ? startGethChainChild()
    : startHardhatChainChild());

  await shell("yarn", ["hardhat", "fundDeployer", "--network", "gethDev"]);

  await shell("yarn", [
    "hardhat",
    "run",
    "scripts/deploy_all.ts",
    "--network",
    "gethDev",
  ]);

  chainChild.off("exit", handleChainEarlyExit);

  const chainExitCode = await new Promise<number>((resolve) =>
    chainChild.on("exit", resolve),
  );

  if (chainExitCode !== 0) {
    process.exit(chainExitCode);
  }
}

async function shell(command: string, args: string[]) {
  const child = spawn(command, args, { stdio: "inherit" });

  await new Promise<void>((resolve, reject) => {
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`${command} ${args.join(" ")} exited with status ${code}`),
        );
      }
    });
  });
}

async function startGethChainChild() {
  await shell("docker", ["pull", "ethereum/client-go:stable"]);

  const containerName = `geth${Math.random().toString().slice(2, 7)}`;

  const gethChild = spawn(
    "docker",
    [
      "run",
      ["--name", containerName],
      "--rm",
      "-p8545:8545",
      "ethereum/client-go:stable",
      "--http",
      ["--http.api", "eth,web3,personal,net"],
      "--http.addr=0.0.0.0",
      "--http.vhosts=*",
      "--dev",
      "--dev.period=0",
    ].flat(),
    { stdio: "inherit" },
  );

  gethChild.on("exit", handleChainEarlyExit);

  onAnyExit(() => {
    if (gethChild.exitCode !== null) {
      gethChild.kill();
    }
  });

  await delay(2000);

  const fundAccountsScript = await readFile(
    require.resolve("./fundAccounts.js"),
    "utf8",
  );

  await shell("docker", [
    "exec",
    containerName,
    "geth",
    "--exec",
    fundAccountsScript,
    "attach",
    "http://localhost:8545",
  ]);

  return gethChild;
}

async function startHardhatChainChild() {
  const hardhatChild = spawn("yarn", ["hardhat", "node"], { stdio: "inherit" });
  await delay(2000);

  return hardhatChild;
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function handleChainEarlyExit(code: number) {
  console.error(`Unexpected early chain exit (${code})`);
  process.exit(1);
}

function onAnyExit(handler: () => void) {
  for (const evt of [
    "exit",
    "SIGINT",
    "SIGUSR1",
    "SIGUSR2",
    "uncaughtException",
    "SIGTERM",
  ]) {
    process.on(evt, handler);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
