import * as dotenv from "dotenv";

import { HardhatUserConfig, task, types } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import spies from "chai-spies";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (_taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("generateMnemonic", "Generates and displays a random mnemonic").setAction(
  async (_params, hre) => {
    const wallet = hre.ethers.Wallet.createRandom();
    console.log(wallet.mnemonic.phrase);
  },
);

// Don't run this unless you really need to...
task("privateKeys", "Prints the private keys for accounts")
  .addParam("force", "Whether the command should be run", false, types.boolean)
  .setAction(async ({ force }: { force: boolean }, hre) => {
    if (!force) {
      throw new Error("are you sure you want to run this task? (--force true)");
    }

    const separator = "-".repeat(3);
    console.log(separator);

    for (let i = 0; i < accounts.count; i++) {
      const wallet = hre.ethers.Wallet.fromMnemonic(
        accounts.mnemonic,
        `m/44'/60'/0'/0/${i}`,
      );
      console.log(`${i}: ${wallet.address}`);
      console.log(wallet.privateKey);
      console.log(separator);
    }
  });

task("sendEth", "Sends ETH to an address")
  .addParam("address", "Address to send ETH to", undefined, types.string)
  .addOptionalParam("amount", "Amount of ETH to send", "1.0")
  .setAction(
    async ({ address, amount }: { address: string; amount: string }, hre) => {
      const [account0] = await hre.ethers.getSigners();

      console.log(`${account0.address} -> ${address} ${amount} ETH`);

      const txnRes = await account0.sendTransaction({
        to: address,
        value: hre.ethers.utils.parseEther(amount),
      });
      await txnRes.wait();
    },
  );

// Do any needed pre-test setup here.
task("test").setAction(async (_taskArgs, _hre, runSuper) => {
  chai.use(chaiAsPromised);
  chai.use(spies);
  await runSuper();
});

// Accounts used for testing and deploying
const accounts = {
  mnemonic: `${process.env.MAIN_MNEMONIC}`,
  count: 5,
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.15",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0, // workaround from https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136 . Remove when that issue is closed.
      accounts,
      blockGasLimit: 30_000_000,
    },
    gethDev: {
      url: `http://localhost:8545`,
      accounts,
      // issue: https://github.com/NomicFoundation/hardhat/issues/3136
      // workaround: https://github.com/NomicFoundation/hardhat/issues/2672#issuecomment-1167409582
      timeout: 100_000,
    },
    arbitrum_goerli: {
      // chainId: 421613
      url: process.env.ARBITRUM_GOERLI_URL,
      accounts,
    },
    arbitrum: {
      // chainId: 42161
      url: process.env.ARBITRUM_URL,
      accounts,
      gasPrice: 700000000,
    },
    optimism_goerli: {
      url: process.env.OPTIMISM_GOERLI_URL,
      accounts,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 120000,
  },
};

export default config;
