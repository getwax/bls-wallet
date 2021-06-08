import { ethers } from "../deps/index.ts";

const provider = new ethers.providers.JsonRpcProvider();

const chainId: number = (await provider.getNetwork()).chainId;
// console.log(chainId);

console.log({ chainId, gasPrice: (await provider.getGasPrice()).toNumber() });
