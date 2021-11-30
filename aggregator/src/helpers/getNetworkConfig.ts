import { NetworkConfig, getConfig } from "../../deps.ts";
import * as env from "../env.ts";

export default function getNetworkConfig(): Promise<NetworkConfig> {
    return getConfig(env.NETWORK_CONFIG_PATH, Deno.readTextFile);   
}
