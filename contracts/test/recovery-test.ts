import { expect } from "chai";

import { ethers, network } from "hardhat";

import Fixture from "../shared/helpers/Fixture";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";

import { BigNumber } from "ethers";
import { PublicKey } from "../clients/deps/hubble-bls/mcl";

describe("Recovery", async function () {
  this.beforeAll(async function () {
    // deploy the deployer contract for the transient hardhat network
    if (network.name === "hardhat") {
      // fund deployer wallet address
      const fundedSigner = (await ethers.getSigners())[0];
      await (
        await fundedSigner.sendTransaction({
          to: defaultDeployerAddress(),
          value: ethers.utils.parseEther("1"),
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

  it("should update bls key", async function () {
    const wallet = await fx.lazyBlsWallets[0]();
    const blsWallet = await ethers.getContractAt("BLSWallet", wallet.address);
    const newKey: PublicKey = [1, 2, 3, 4].map(BigNumber.from);
    const initialKey = await blsWallet.getBLSPublicKey();

    await fx.call(wallet, blsWallet, "setBLSPublicKey", [newKey], 1);

    expect(await blsWallet.getBLSPublicKey()).to.eql(initialKey);

    await fx.advanceTimeBy(24 * 7 * 60 * 60 + 1);
    await (await blsWallet.setAnyPending()).wait();

    expect(await blsWallet.getBLSPublicKey()).to.eql(newKey);
  });
});
