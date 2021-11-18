import { expect } from "chai";

import { ethers, network } from "hardhat";
const utils = ethers.utils;

import Fixture from "../shared/helpers/Fixture";
import TokenHelper from "../shared/helpers/TokenHelper";

import { BigNumber } from "ethers";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";

describe('Upgrade', async function () {
  this.beforeAll(async function () {
    // deploy the deployer contract for the transient hardhat network
    if (network.name === "hardhat") {
      // fund deployer wallet address
      let fundedSigner = (await ethers.getSigners())[0];
      await (await fundedSigner.sendTransaction({
        to: defaultDeployerAddress(),
        value: utils.parseEther("1")
      })).wait();

      // deploy the precompile contract (via deployer)
      console.log("PCE:", await deployAndRunPrecompileCostEstimator());
    }
  });

  let fx: Fixture;
  let th: TokenHelper;
  beforeEach(async function() {
    fx = await Fixture.create();
  });

  it('should upgrade wallet contract', async function () {
    const wallet = await fx.lazyBlsWallets[0]();
    const BLSWallet = await ethers.getContractFactory("BLSWallet");
    let blsWallet = BLSWallet.attach(wallet.address);

    expect((await blsWallet.getPublicKey())[0].toHexString()).to.equal(
      wallet.blsWalletSigner.getPublicKey(wallet.privateKey)[0],
    );

    const MockWalletUpgraded = await ethers.getContractFactory("MockWalletUpgraded");
    let mockWalletUpgraded = await MockWalletUpgraded.deploy();

    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    let upgradeFunctionData = ProxyAdmin.interface.encodeFunctionData(
      "upgrade",
      [blsWallet.address, mockWalletUpgraded.address]
    );

    fx.verificationGateway.actionCalls(
      wallet.sign({
        nonce: await wallet.Nonce(),
        actions: [
          {
            contract: fx.verificationGateway.contract,
            method: "walletAdminCall",
            args: [
              wallet.blsWalletSigner.getPublicKeyHash(wallet.privateKey),
              upgradeFunctionData
            ],
          },
        ],
      }),
    );

    let newBLSWallet = MockWalletUpgraded.attach(wallet.address);
    await (await newBLSWallet.setNewData(wallet.address)).wait();
    expect(await newBLSWallet.newData()).to.equal(wallet.address);
  });
});
