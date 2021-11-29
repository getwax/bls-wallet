import { expect } from "chai";

import { ethers, network } from "hardhat";

import Fixture from "../shared/helpers/Fixture";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";

describe("Upgrade", async function () {
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

  it("should upgrade wallet contract", async function () {
    const wallet = await fx.lazyBlsWallets[0]();
    const BLSWallet = await ethers.getContractFactory("BLSWallet");
    const blsWallet = BLSWallet.attach(wallet.address);

    expect((await blsWallet.getPublicKey())[0].toHexString()).to.equal(
      wallet.blsWalletSigner.getPublicKey(wallet.privateKey)[0],
    );

    const MockWalletUpgraded = await ethers.getContractFactory(
      "MockWalletUpgraded",
    );
    const mockWalletUpgraded = await MockWalletUpgraded.deploy();

    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const upgradeFunctionData = ProxyAdmin.interface.encodeFunctionData(
      "upgrade",
      [blsWallet.address, mockWalletUpgraded.address],
    );

    await (
      await fx.verificationGateway.processBundle(
        wallet.sign({
          nonce: await wallet.Nonce(),
          actions: [
            {
              ethValue: ethers.BigNumber.from(0),
              contractAddress: fx.verificationGateway.address,
              encodedFunction:
                fx.verificationGateway.interface.encodeFunctionData(
                  "walletAdminCall",
                  [
                    wallet.blsWalletSigner.getPublicKeyHash(wallet.privateKey),
                    upgradeFunctionData,
                  ],
                ),
            },
          ],
        }),
      )
    ).wait();

    const newBLSWallet = MockWalletUpgraded.attach(wallet.address);
    await (await newBLSWallet.setNewData(wallet.address)).wait();
    expect(await newBLSWallet.newData()).to.equal(wallet.address);
  });
});
