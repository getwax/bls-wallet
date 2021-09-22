import { BigNumber, Contract, ContractFactory } from "ethers";
import { network } from "hardhat";
import Fixture, { FullTxData } from "../../shared/helpers/Fixture";
import getDeployedAddresses, { DeployedAddresses } from "../../shared/helpers/getDeployedAddresses";
import blsSignFunction from "../../shared/helpers/blsSignFunction";

import { solG1 } from "../../shared/lib/hubble-bls/src/mcl";
import { BlsSignerInterface, aggregate } from "../../shared/lib/hubble-bls/src/signer";

import { ethers } from "hardhat";

let config: DeployedAddresses;

let ethToken: Contract;
let rewardToken: Contract;


let blsWallets: Contract[];

async function main() {
  config = getDeployedAddresses(network.name);

  // setup fixture with bls wallet secret numbers
  let fx = await setup([
    +process.env.BLS_SECRET_NUM_1,
    +process.env.BLS_SECRET_NUM_2,
    +process.env.BLS_SECRET_NUM_3
  ]);

  let createNew = false;
  if (createNew) {
    config.blsAddresses = await fx.createBLSWallets();
    console.log(`Created new blsWallet contracts: ${config.blsAddresses}`);
  }
  blsWallets = config.blsAddresses.map( a => fx.BLSWallet.attach(a) );
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


//   }
// }


async function setup(blsSecretNumbers: number[]): Promise<Fixture> {
  let fx = await Fixture.create(
    blsSecretNumbers.length,
    true,
    config.vgAddress,
    config.expanderAddress,
    blsSecretNumbers
  );

  let ERC20 = await ethers.getContractFactory("MockERC20");
  ERC20.attach(config.rewardAddress);
  if (config.ethAddress) {
    ethToken = ERC20.attach(config.ethAddress);
  }  
  return fx;
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  