import { readFile } from "fs/promises";
import path from "path";
import { NetworkConfig, getConfig } from "../../clients/src";

function getFileName(networkName: string) {
  if (networkName === "gethDev") {
    return "local";
  }
  return networkName;
}

export default function getNetworkConfig(
  networkName: string,
): Promise<NetworkConfig> {
  const netCfgPath = path.resolve(
    __dirname,
    "../../networks",
    `${getFileName(networkName)}.json`,
  );
  return getConfig(netCfgPath, async (path) => readFile(path, "utf8"));
}
