import { expect } from "chai";

import { ethers, network } from "hardhat";

import Fixture from "../shared/helpers/Fixture";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";
import splitHex256 from "../shared/helpers/splitHex256";

describe('Upgrade', async function () {
  this.beforeAll(async function () {
    // deploy the deployer contract for the transient hardhat network
    if (network.name === "hardhat") {
      // fund deployer wallet address
      let fundedSigner = (await ethers.getSigners())[0];
      await (await fundedSigner.sendTransaction({
        to: defaultDeployerAddress(),
        value: ethers.utils.parseEther("1")
      })).wait();

      // deploy the precompile contract (via deployer)
      console.log("PCE:", await deployAndRunPrecompileCostEstimator());
    }
  });

  let fx: Fixture;
  beforeEach(async function() {
    fx = await Fixture.create();
  });

  it('should upgrade wallet contract', async function () {
    const wallet = await fx.lazyBlsWallets[0]();
    const BLSWallet = await ethers.getContractFactory("BLSWallet");
    let blsWallet = BLSWallet.attach(wallet.address);

    expect((await blsWallet.getPublicKey())[0].toHexString()).to.equal(
      splitHex256(wallet.blsWalletSigner.getPublicKey(wallet.privateKey))[0],
    );

    const MockWalletUpgraded = await ethers.getContractFactory("MockWalletUpgraded");
    let mockWalletUpgraded = await MockWalletUpgraded.deploy();

    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    let upgradeFunctionData = ProxyAdmin.interface.encodeFunctionData(
      "upgrade",
      [blsWallet.address, mockWalletUpgraded.address]
    );

    await (await fx.verificationGateway.actionCalls(
      wallet.sign({
        nonce: await wallet.Nonce(),
        atomic: true,
        actions: [
          {
            ethValue: ethers.BigNumber.from(0),
            contractAddress: fx.verificationGateway.contract.address,
            encodedFunction: fx.verificationGateway.contract.interface.encodeFunctionData(
              "walletAdminCall",
              [
                wallet.blsWalletSigner.getPublicKeyHash(wallet.privateKey),
                upgradeFunctionData
              ],
            ),
          },
        ],
      }),
    )).wait();

    let newBLSWallet = MockWalletUpgraded.attach(wallet.address);
    await (await newBLSWallet.setNewData(wallet.address)).wait();
    expect(await newBLSWallet.newData()).to.equal(wallet.address);
  });
});
