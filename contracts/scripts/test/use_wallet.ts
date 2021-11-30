/* eslint-disable no-process-exit */

import { network, ethers } from "hardhat";
import Fixture from "../../shared/helpers/Fixture";
import getNetworkConfig from "../../shared/helpers/getNetworkConfig";

let config;

// let ethToken: Contract;

let blsAddresses: string[];

async function setup(blsSecretNumbers: number[]): Promise<Fixture> {
  config = await getNetworkConfig(network.name);
  console.log("config:", config);

  console.log("Creating fixture from use wallet...");
  const fx = await Fixture.create(blsSecretNumbers.length, blsSecretNumbers);

  console.log("Attaching to token:", config.addresses.testToken);
  const ERC20 = await ethers.getContractFactory("MockERC20");
  ERC20.attach(config.addresses.testToken);

  return fx;
}

async function main() {
  // setup fixture with bls wallet secret numbers
  const fx = await setup([
    +process.env.BLS_SECRET_NUM_1,
    +process.env.BLS_SECRET_NUM_2,
    +process.env.BLS_SECRET_NUM_3,
  ]);

  blsAddresses = (await fx.createBLSWallets()).map((wallet) => wallet.address);
  console.log(`BlsWallet contract addresses: ${blsAddresses}`);

  // blsWallets = blsAddresses.map((a) => fx.BLSWallet.attach(a));

  // blsSignFunction({
  //   blsSigner: fx.blsSigners[0],
  //   chainId: fx.chainId,
  //   nonce: ,
  //   reward: ,
  //   contract: ,
  //   functionName: ,
  //   params: []
  //   })
}

// class Wallet {

//   constructor(
//     signer: BlsSignerInterface,
//     contract: Contract
//   ) {

// }
// }

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
