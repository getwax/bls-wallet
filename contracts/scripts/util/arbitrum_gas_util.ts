import { appendFile } from "fs/promises";
/*
 Web3 needs to be used over Ethers since web3 tx receipts
 for Arbitrum correctly store the feeStats object.
 Ethers' tx receipts aren't updated to store that yet.
 */
import Web3 from "web3";
import { AbiItem } from "web3-utils";
import { ARB_GAS_INFO_ABI } from "./ArbGasInfoAbi";
import dotenv from "dotenv";

import * as child from "child_process";
dotenv.config();
// current git commit
const REVISION = child.execSync("git rev-parse HEAD").toString().trim();

const web3Mainnet = new Web3(process.env.ARBITRUM_URL);
const web3Rinkeby = new Web3(process.env.ARBITRUM_TESTNET_URL);

const ARBITRUM_GAS_COST_FILE = "./ArbitrumGasCosts.md";
const NUM_DECIMALS = 7;
/*
 This contract was predeployed to Arbitrum and can be used
 to retreive current gas prices.
 For more info on pre-deploys: https://developer.offchainlabs.com/docs/useful_addresses
 */
const MAINNET_ARB_GAS_INFO_ADDRESS =
  "0x000000000000000000000000000000000000006C";

export async function processGasResultsToFile(
  blsTxHash,
  normalTxHash,
  numTxsAggregated,
) {
  console.log("Retrieving gas results");

  const blsEntry = await newTableEntry(blsTxHash, numTxsAggregated, true);
  const normalEntry = await newTableEntry(
    normalTxHash,
    numTxsAggregated,
    false,
  );

  const input = "\n" + blsEntry + "\n" + normalEntry;

  console.log("Writing gas results to file");
  await appendFile(ARBITRUM_GAS_COST_FILE, input);
}

async function newTableEntry(txHash, numTxs, isBlsTx) {
  // Need "as any" to get the feeStats field unique to the Arbitrum network
  const txReceipt = (await web3Rinkeby.eth.getTransactionReceipt(
    txHash,
  )) as any;
  const units = txReceipt.feeStats.unitsUsed;
  let txType;
  if (isBlsTx) {
    txType = "BLS";
  } else {
    txType = "Normal";
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
    `| ${REVISION} | ${txType} | ${numTxs} | ${parseInt(units.l1Calldata)}` +
    ` | ${parseInt(units.l1Transaction)} | ${parseInt(units.l2Computation)}` +
    ` | ${parseInt(units.l2Storage)} | ${costs.l1Calldata.toFixed(
      NUM_DECIMALS,
    )}` +
    ` | ${costs.l2Tx.toFixed(NUM_DECIMALS)} | ${costs.storage.toFixed(
      NUM_DECIMALS,
    )}` +
    ` | ${costs.computation.toFixed(NUM_DECIMALS)} | ${costs.total.toFixed(
      NUM_DECIMALS,
    )}` +
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
