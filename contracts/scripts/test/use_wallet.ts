/* eslint-disable no-process-exit */

import { network, ethers } from "hardhat";
import Fixture from "../../shared/helpers/Fixture";
import getDeployedAddresses, {
  DeployedAddresses,
} from "../../shared/helpers/getDeployedAddresses";

let config: DeployedAddresses;

// let ethToken: Contract;

// let blsWallets: Contract[];

async function setup(blsSecretNumbers: number[]): Promise<Fixture> {
  config = getDeployedAddresses(network.name);
  console.log("config:", config);

  console.log("Creating fixture from use wallet...");
  const fx = await Fixture.create(
    blsSecretNumbers.length,
    true,
    config.blsLibAddress,
    config.vgAddress,
    config.expanderAddress,
    blsSecretNumbers,
  );

  console.log("Attaching to token:", config.tokenAddress);
  const ERC20 = await ethers.getContractFactory("MockERC20");
  ERC20.attach(config.tokenAddress);
  // if (config.ethAddress) {
  //   ethToken = ERC20.attach(config.ethAddress);
  // }
  return fx;
}

async function main() {
  // setup fixture with bls wallet secret numbers
  const fx = await setup([
    +process.env.BLS_SECRET_NUM_1,
    +process.env.BLS_SECRET_NUM_2,
    +process.env.BLS_SECRET_NUM_3,
  ]);

  config.blsAddresses = (await fx.createBLSWallets()).map(
    (wallet) => wallet.address,
  );
  console.log(`BlsWallet contract addresses: ${config.blsAddresses}`);

  // blsWallets = config.blsAddresses.map((a) => fx.BLSWallet.attach(a));

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
