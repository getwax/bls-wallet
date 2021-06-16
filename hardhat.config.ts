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
      // {
      //   version: "0.8.0"
      // },
      {
        version: "0.7.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      }
    ]
  },
  ovm: {
    solcVersion: "0.7.6"
  },
  networks: {
    hardhat: {
    },
    optimism: {
      url: `http://localhost:8545`,
      accounts: [
        `0x${process.env.PRIVATE_KEY_AGG}`,
        `0x${process.env.PRIVATE_KEY_002}`,
        `0x${process.env.PRIVATE_KEY_003}`,
        `0x${process.env.PRIVATE_KEY_004}`,
        `0x${process.env.PRIVATE_KEY_005}`
      ],
      gasPrice: 0,
      ovm: true
    }
  },
  mocha: {
    timeout: 120000
  }
};

export default config;
