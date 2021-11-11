import { expect } from "chai";
import expectRevert from "../shared/helpers/expectRevert";

import { ethers, network } from "hardhat";
const utils = ethers.utils;

import Fixture, { FullTxData } from "../shared/helpers/Fixture";
import TokenHelper from "../shared/helpers/TokenHelper";
import dataPayload from "../shared/helpers/dataPayload";

import { aggregate } from "../shared/lib/hubble-bls/src/signer";
import { BigNumber } from "ethers";
import blsKeyHash from "../shared/helpers/blsKeyHash";
import blsSignFunction from "../shared/helpers/blsSignFunction";
import { parseEther } from "@ethersproject/units";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import getDeployedAddresses from "../shared/helpers/getDeployedAddresses";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";
import { ProxyAdmin, ProxyAdmin__factory } from "../typechain";


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
    let blsSigner = fx.blsSigners[0];  
    let walletAddress = await fx.createBLSWallet(blsSigner);
    const BLSWallet = await ethers.getContractFactory("BLSWallet");
    let blsWallet = BLSWallet.attach(walletAddress);

    expect((await blsWallet.getPublicKey())[0].toHexString()).to.equal(blsSigner.pubkey[0]);

    const MockWalletUpgraded = await ethers.getContractFactory("MockWalletUpgraded");
    let mockWalletUpgraded = await MockWalletUpgraded.deploy();

    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    let upgradeFunctionData = ProxyAdmin.interface.encodeFunctionData(
      "upgrade",
      [blsWallet.address, mockWalletUpgraded.address]
    );

    await fx.gatewayCallFull({
      blsSigner: blsSigner,
      chainId: fx.chainId,
      nonce: (await blsWallet.nonce()).toNumber(),
      ethValue: BigNumber.from(0),
      contract: fx.verificationGateway,
      functionName: "walletAdminCall",
      params: [
        blsKeyHash(blsSigner),
        upgradeFunctionData
      ]
    });

    let newBLSWallet = MockWalletUpgraded.attach(walletAddress);
    await (await newBLSWallet.setNewData(walletAddress)).wait();
    expect(await newBLSWallet.newData()).to.equal(walletAddress);

  });

});

