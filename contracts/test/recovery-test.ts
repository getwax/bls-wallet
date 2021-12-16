import { expect } from "chai";

import { ethers, network } from "hardhat";

import Fixture from "../shared/helpers/Fixture";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";

import {
  proxyAdminBundle,
  proxyAdminCall,
} from "../shared/helpers/callProxyAdmin";
import Create2Fixture from "../shared/helpers/Create2Fixture";
import { BLSOpen } from "../typechain";
import { BigNumber } from "ethers";
import defaultDomain from "../clients/src/signer/defaultDomain";
import { BlsSignerFactory } from "../clients/deps/hubble-bls/signer";
import { solidityPack } from "ethers/lib/utils";
import { PublicKey } from "../clients/deps/hubble-bls/mcl";

describe.only("Upgrade", async function () {
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

    await (
      await fx.verificationGateway.processBundle(
        fx.blsWalletSigner.aggregate([
          wallet.sign({
            nonce: BigNumber.from(1),
            actions: [
              {
                ethValue: 0,
                contractAddress: blsWallet.address,
                encodedFunction: blsWallet.interface.encodeFunctionData(
                  "setBLSPublicKey",
                  [newKey],
                ),
              },
            ],
          }),
        ]),
      )
    ).wait();

    expect(await blsWallet.getBLSPublicKey()).to.eql(initialKey);

    // Advance time one week
    const latestTimestamp = (await ethers.provider.getBlock("latest"))
      .timestamp;
    await network.provider.send("evm_setNextBlockTimestamp", [
      BigNumber.from(latestTimestamp)
        .add(24 * 7 * 60 * 60 + 1)
        .toHexString(),
    ]);
    await blsWallet.setAnyPending();

    expect(await blsWallet.getBLSPublicKey()).to.eql(newKey);
  });
});
