require('dotenv').config();
import { HardhatUserConfig, NetworkUserConfig } from "hardhat/types";

import '@eth-optimism/hardhat-ovm';
// import '@eth-optimism/plugins/hardhat/compiler'
// import '@eth-optimism/plugins/hardhat/ethers'

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { task } from "hardhat/config";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      }
    ]
  },
  networks: {
    gethDev: {
      url: `http://localhost:8545`,
      accounts: [
        `0x${process.env.PRIVATE_KEY_AGG}`,
        `0x${process.env.PRIVATE_KEY_002}`,
        `0x${process.env.PRIVATE_KEY_003}`,
        `0x${process.env.PRIVATE_KEY_004}`,
        `0x${process.env.PRIVATE_KEY_005}`
      ],
      gasPrice: 0
    },
    optimistic: {
      url: `http://localhost:8545`,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        initialIndex: 2, // After optimism deployer, sequencer
        count: 5
      },
      gasPrice: 0,//15000000,
      ovm: true
    },
    optimisticKovan: {
      url: 'https://kovan.optimism.io',
      accounts: [
        `0x${process.env.PRIVATE_KEY_AGG_OKOV}`,
        `0x${process.env.PRIVATE_KEY_002}`,
        `0x${process.env.PRIVATE_KEY_003}`,
        `0x${process.env.PRIVATE_KEY_004}`,
        `0x${process.env.PRIVATE_KEY_005}`
      ],
      gasPrice: 15000000,
      ovm: true // This sets the network as using the ovm and ensure contract will be compiled against that.
    }
  }
};

export default config;
