/**
 * Example usage:
 *
 * yarn hardhat run scripts/test/send_eth.ts --network gethDev
 */

/* eslint-disable no-process-exit */
import { ethers } from "hardhat";

// Change this to the address you want to send eth to.
// We should bring in an npm package at some point to parse cli args.
const receivingAddress = "0x6266142188e26AfA67Caf6FDD581edc1958d7172";
// Change this to the amount of eth you want to send.
const amountEth = "1.0";

async function main() {
  const [account0] = await ethers.getSigners();
  console.log(`${account0.address} -> ${receivingAddress} ${amountEth} ETH`);
  await account0.sendTransaction({
    to: receivingAddress,
    value: ethers.utils.parseEther(amountEth),
  });
  console.log("done");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
