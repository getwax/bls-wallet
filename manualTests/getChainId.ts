import { ethers } from "../deps/index.ts";

import * as env from "../src/env.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const chainId: number = (await provider.getNetwork()).chainId;
// console.log(chainId);

console.log({ chainId, gasPrice: (await provider.getGasPrice()).toNumber() });
