import { expect } from "chai";
import { ethers, network } from "hardhat";

import Fixture from "../shared/helpers/Fixture";

import { parseEther } from "ethers/lib/utils";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";

describe("Provider test", async function () {
  this.beforeAll(async function () {
    // deploy the deployer contract for the transient hardhat network
    if (network.name === "hardhat") {
      // fund deployer wallet address
      const fundedSigner = (await ethers.getSigners())[0];
      await (
        await fundedSigner.sendTransaction({
          to: defaultDeployerAddress(),
          value: parseEther("1"),
        })
      ).wait();

      // deploy the precompile contract (via deployer)
      console.log("PCE:", await deployAndRunPrecompileCostEstimator());
    }
  });

  let fx: Fixture;
  beforeEach(async function () {
    fx = await Fixture.create();
  });

  it("Test a send", async function () {
    const walletBalanceBefore = await fx.provider.getBalance(
      await fx.signers[1].getAddress(),
    );
    console.log("before: ", ethers.utils.formatEther(walletBalanceBefore));
    const ethToTransfer = parseEther("0.0001");

    await fx.signers[0].sendTransaction({
      to: await fx.signers[1].getAddress(),
      value: ethToTransfer,
    });

    const walletBalanceAfter = await fx.provider.getBalance(
      await fx.signers[1].getAddress(),
    );
    console.log("after: ", ethers.utils.formatEther(walletBalanceAfter));
    expect(walletBalanceAfter.sub(walletBalanceBefore)).to.equal(ethToTransfer);
  });
});
