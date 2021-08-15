import { BigNumber, Contract, ContractFactory } from "ethers";
import { network } from "hardhat";
import Fixture, { FullTxData } from "../../shared/helpers/Fixture";
import blsSignFunction from "../../shared/helpers/blsSignFunction";

import { solG1 } from "../../shared/lib/hubble-bls/src/mcl";
import { BlsSignerInterface, aggregate } from "../../shared/lib/hubble-bls/src/signer";

let config: DeployedAddresses;

let ethToken: Contract;
let rewardToken: Contract;


let blsWallets: Contract[];

interface DeployedAddresses {
  ethAddress: string|undefined;
  rewardAddress: string|undefined;
  vgAddress: string|undefined;
  expanderAddress: string|undefined;
  tokenAddress: string|undefined;
  blsAddresses: string[]|undefined;
}

async function main() {
  config = addressesForNetwork(network.name);

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


function addressesForNetwork(networkName: string): DeployedAddresses {
  let c: DeployedAddresses;
  if (network.name === `optimistic`) {
    c = {
      ethAddress:undefined,
      rewardAddress: process.env.LOCAL_REWARD_CONTRACT_ADDRESS,
      vgAddress:process.env.LOCAL_VERIFICATION_GATEWAY_ADDRESS,
      expanderAddress: process.env.LOCAL_BLS_EXPANDER_ADDRESS,
      tokenAddress: undefined,
      blsAddresses: [
        '0x69A9c53e7000c8B7aF3f70212ba7a8E30fB30Cb4',
        '0xAeaDee30db4e75c64BC8ABE54f818b8fc9097f1b',
        '0x4FCa9CA9938Ee6b4E3200a295b1152c72d6df0b7'
      ]
    };
  }
  else if (network.name === `optimisticKovan`) {
    c = {
      ethAddress: process.env.OKOVAN_ETH_CONTRACT_ADDRESS,
      vgAddress: process.env.OKOVAN_VERIFICATION_GATEWAY_ADDRESS,
      expanderAddress: process.env.OKOVAN_BLS_EXPANDER_ADDRESS,
      rewardAddress: process.env.OKOVAN_REWARD_CONTRACT_ADDRESS,
      tokenAddress: process.env.OKOVAN_ERC20_CONTRACT_ADDRESS,
      blsAddresses: [
        '0xEc76AE8adEFc6462986A673Feff40b2Cdd56B3BC',
        '0x808AeC84A987368B915a7Fd048cd1B20859FcbC9',
        '0x00478B7Ea27581f901D84a7ea2989f68416d3568'
      ]
    }
  } else {
    throw new Error(`Not configured for "${network.name}"`);
  }

  return c;
}

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
  