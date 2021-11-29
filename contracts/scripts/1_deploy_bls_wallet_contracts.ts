import { network } from "hardhat";
import getDeployedAddresses from "../shared/helpers/getDeployedAddresses";

import Fixture from "../shared/helpers/Fixture";

require("dotenv").config();

async function main() {
  let fx: Fixture;
  if (network.name == "rinkarby") {
    const addresses = getDeployedAddresses(network.name);

    fx = await Fixture.create();
  } else {
    fx = await Fixture.create();
  }
  console.log(`Deployer account address: ${fx.addresses[0]}`);

  console.log(`verificationGateway: ${fx.verificationGateway.address}`);
  console.log(`blsExpander: ${fx.blsExpander.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
