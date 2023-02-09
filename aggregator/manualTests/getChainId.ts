#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

import { ethers } from "../deps.ts";

import * as env from "../src/env.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const chainId: number = (await provider.getNetwork()).chainId;
// console.log(chainId);

console.log({ chainId, gasPrice: (await provider.getGasPrice()).toNumber() });
