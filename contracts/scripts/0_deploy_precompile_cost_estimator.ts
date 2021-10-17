import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";

const hre = require("hardhat");

async function main() {
  // await hre.run('compile');

  ;
  console.log(
    "PrecompileCostEstimator:",
    await deployAndRunPrecompileCostEstimator()
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
