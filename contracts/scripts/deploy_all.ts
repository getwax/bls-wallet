/* eslint-disable no-process-exit */
/**
 * yarn hardhat run ./scripts/deploy_all.ts --network network_from_hardhat_config
 *
 * Make sure create2Deployer is funded before running
 * yarn hardhat fundDeployer --network network_from_hardhat_config --amount 1.0 # optional
 */

import * as dotenv from "dotenv";
import util from "util";
import { exec as execCb } from "child_process";
import { writeFile } from "fs/promises";
import { ethers } from "hardhat";
import { NetworkConfig } from "../clients/src";
import deploy from "../shared/deploy";
import getDomain from "../clients/src/signer/getDomain";

dotenv.config();
const exec = util.promisify(execCb);

const netCfgFilePath = "./networks/local.json";

async function deployToken(): Promise<string> {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const initialSupply = ethers.utils.parseUnits("1000000");
  const testToken = await MockERC20.deploy("AnyToken", "TOK", initialSupply);
  await testToken.deployed();

  return testToken.address;
}

async function getVersion(): Promise<string> {
  const { stdout } = await exec("git rev-parse HEAD");
  return stdout.trim();
}

async function main() {
  console.log("starting bls-wallet contracts deployment");
  const genesisBlock = await ethers.provider.getBlockNumber();

  const chainid = (await ethers.provider.getNetwork()).chainId;

  const [signer] = await ethers.getSigners();

  console.log("deploying contracts...");
  const deployment = await deploy(signer);

  console.log("deploying test token...");
  // These can be run in parallel
  const [testToken, version] = await Promise.all([deployToken(), getVersion()]);

  const domainName = "BLS_WALLET";
  const domainVersion = "1";
  const walletDomain = getDomain(
    domainName,
    domainVersion,
    chainid,
    deployment.verificationGateway.address,
    "Wallet",
  );

  const bundleDomain = getDomain(
    domainName,
    domainVersion,
    chainid,
    deployment.verificationGateway.address,
    "Bundle",
  );

  const netCfg: NetworkConfig = {
    parameters: {},
    addresses: {
      safeSingletonFactory: deployment.singletonFactory.address,
      precompileCostEstimator: deployment.precompileCostEstimator.address,
      verificationGateway: deployment.verificationGateway.address,
      blsExpander: deployment.blsExpander.address,
      utilities: deployment.aggregatorUtilities.address,
      testToken,
    },
    auxiliary: {
      chainid,
      walletDomain: ethers.utils.toUtf8String(walletDomain),
      bundleDomain: ethers.utils.toUtf8String(bundleDomain),
      genesisBlock,
      deployedBy: signer.address,
      version,
    },
  };
  const jsonStr = JSON.stringify(netCfg, null, 4);
  console.log(`writing network config to ${netCfgFilePath}`);
  console.log(jsonStr);
  await writeFile(netCfgFilePath, jsonStr);

  console.log("bls-wallet contracts deployment complete");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
