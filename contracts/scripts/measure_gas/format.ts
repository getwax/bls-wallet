// This file is being kept for historical reference
// and will be modified/removed in future work.
/*
import { appendFile } from "fs/promises";
import dotenv from "dotenv";

import * as child from "child_process";
dotenv.config();
// current git commit
const REVISION = child.execSync("git rev-parse HEAD").toString().trim();

const ARBITRUM_GAS_COST_FILE = "./ArbitrumGasCosts.md";
const NUM_DECIMALS = 7;

export async function processGasResultsToFile(
  provider,
  blsTxHash,
  normalTxHash,
  numTxsAggregated,
) {
  console.log("Retrieving gas results");

  const blsEntry = await newTableEntry(
    provider,
    blsTxHash,
    numTxsAggregated,
    true,
  );
  const normalEntry = await newTableEntry(
    provider,
    normalTxHash,
    numTxsAggregated,
    false,
  );

  const input = "\n" + blsEntry + "\n" + normalEntry;

  console.log("Writing gas results to file");
  await appendFile(ARBITRUM_GAS_COST_FILE, input);
}

async function newTableEntry(provider, txHash, numTxs, isBlsTx) {
  // Need "as any" to get the feeStats field unique to the Arbitrum network
  const txReceipt = await provider.getTransactionReceipt(txHash);
  const units = txReceipt.feeStats.unitsUsed;
  let txType;
  let totalCost = txReceipt.gasUsed;
  if (isBlsTx) {
    txType = "BLS";
  } else {
    txType = "Normal";
    totalCost = txReceipt.gasUsed * numTxs;
    units.l1Calldata = units.l1Calldata * numTxs;
    units.l1Transaction = units.l1Transaction * numTxs;
    units.l2Computation = units.l2Computation * numTxs;
    units.l2Storage = units.l2Storage * numTxs;
  }

  const mainnetGasInfo = await getMainnetGasDescription();
  const costs = {
    l2Tx: mainnetGasInfo[0] * units.l1Transaction,
    l1Calldata: mainnetGasInfo[1] * units.l1Calldata,
    storage: mainnetGasInfo[2] * units.l2Storage,
    computation: mainnetGasInfo[3] * units.l2Computation,
    total: 0,
  };
  costs.total =
    costs.l2Tx + costs.l1Calldata + costs.storage + costs.computation;

  return (
    `| ${REVISION} | ${txType} | ${numTxs} | ${-1}` +
    ` | ${-2} | ${-3}` +
    ` | ${-4} | ${-4}` +
    ` | ${-5} | ${-6}` +
    ` | ${-7} | ${totalCost}` +
    ` | ${txHash} |`
  );
}

async function getMainnetGasDescription() {
  const arbGasInfoContract = new web3Mainnet.eth.Contract(
    ARB_GAS_INFO_ABI as AbiItem[],
    MAINNET_ARB_GAS_INFO_ADDRESS,
  );
  const mainnetGasInfo = await arbGasInfoContract.methods
    .getPricesInWei()
    .call();
  for (const [key] of Object.entries(mainnetGasInfo)) {
    // Convert Wei to Eth
    mainnetGasInfo[key] *= 1e-18;
  }

  return mainnetGasInfo;
}
*/
