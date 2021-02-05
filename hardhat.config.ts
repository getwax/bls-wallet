require('dotenv').config();
import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { HardhatUserConfig } from "hardhat/config";

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
        version: "0.8.0"
      },
      {
        version: "0.7.0"
      }
    ]
  },
  networks: {
    hardhat: {

    },
    optimism: {
      url: `http://localhost:8545`,
      accounts: [
        `0x${process.env.PRIVATE_KEY_1}`,
        `0x${process.env.PRIVATE_KEY_2}`,
        `0x${process.env.PRIVATE_KEY_3}`,
        `0x${process.env.PRIVATE_KEY_4}`,
        `0x${process.env.PRIVATE_KEY_5}`
      ]
    }
  }
};

export default config;
