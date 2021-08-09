import { Address } from "cluster";
import { Contract, ContractFactory } from "ethers";
import { network, ethers } from "hardhat";
import Fixture from "../../shared/helpers/Fixture";
import TokenHelper from "../../shared/helpers/TokenHelper";

import { aggregate } from "../../shared/lib/hubble-bls/src/signer";

let fx: Fixture;
let ERC20: ContractFactory;
let rewardToken: Contract;

let vgAddress: string;
let expanderAddress: string;

async function main() {
  await attachContracts();
  
  let balances = await Promise.all(
    fx.addresses.map( a => rewardToken.balanceOf(a) )
  );
  console.log(balances.map( ethers.utils.formatEther ));

}

async function attachContracts() {
  if (network.name === `optimistic`) {
    vgAddress = `${process.env.LOCAL_VERIFICATION_GATEWAY_ADDRESS}`;
    expanderAddress = `${process.env.LOCAL_BLS_EXPANDER_ADDRESS}`;
  }
  else if (network.name === `optimisticKovan`) {
    vgAddress = `${process.env.OKOVAN_VERIFICATION_GATEWAY_ADDRESS}`;
    expanderAddress = `${process.env.OKOVAN_BLS_EXPANDER_ADDRESS}`;
  } else {
    throw new Error(`Not configured for "${network.name}"`);
  }

  fx = await Fixture.create(1, true, vgAddress, expanderAddress);
  let rewardAddress = await fx.verificationGateway.paymentToken();  
  ERC20 = await ethers.getContractFactory("MockERC20");
  rewardToken = ERC20.attach(rewardAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  