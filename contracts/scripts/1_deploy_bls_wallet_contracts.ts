/* eslint-disable no-process-exit */

import Fixture from "../shared/helpers/Fixture";

require("dotenv").config();

async function main() {
  const fx = await Fixture.create();
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
