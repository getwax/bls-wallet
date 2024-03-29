#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import * as env from "../src/env.ts";
import { ethers } from "../deps.ts";
import OptimismGasPriceOracle from "../src/app/OptimismGasPriceOracle.ts";

const oracle = new OptimismGasPriceOracle(
  new ethers.providers.JsonRpcProvider(env.RPC_URL),
);

const { l1BaseFee, overhead, scalar, decimals } = await oracle.getAllParams();

console.log({
  l1BaseFee: `${(l1BaseFee.toNumber() / 1e9).toFixed(3)} gwei`,
  overhead: `${overhead.toNumber()} L1 gas`,
  scalar: scalar.toNumber() / (10 ** decimals.toNumber()),
});
