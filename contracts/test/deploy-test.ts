import * as dotenv from "dotenv";

import { expect, assert } from "chai";
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers";

import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";
import { Create2DeployerInterface } from "../typechain/Create2Deployer";

describe('Deployer', async function () {
  if (`${process.env.DEPLOYER_DEPLOYMENT}` !== "true") {
    console.log("Skipping deployer tests. (DEPLOYER_DEPLOYMENT !== true)");
    return;
  }
  let deployerSigner;
  let eoaAddress;
  let Create2Deployer;
  let create2Deployer;
  this.beforeAll(async function () {
    deployerSigner = (await ethers.getSigners())[0];
    eoaAddress = deployerSigner.address;
    Create2Deployer = await ethers.getContractFactory("Create2Deployer");

    //one-time deployment
    create2Deployer = await Create2Deployer.deploy();
    await create2Deployer.deployed();
  });

  beforeEach(async function() {
  });

  it('should calculate EOA deployed address', async function () {
    let calculatedAddress = ethers.utils.getContractAddress({
      from: eoaAddress,
      nonce: BigNumber.from(0)
    });
    expect(calculatedAddress).to.equal(create2Deployer.address);
  });

  it('should deploy to caculated address', async function () {
    let testSalt = "0";
    const initCodeHash = ethers.utils.solidityKeccak256(
      ["bytes"],
      [Create2Deployer.bytecode]
    );
    let calculatedAddress = ethers.utils.getCreate2Address(
      create2Deployer.address,
      "0x"+"00".repeat(32),
      initCodeHash
    );
    expect(calculatedAddress).to.equal(
      await create2Deployer.addressFrom(
        create2Deployer.address,
        testSalt,
        Create2Deployer.bytecode
      )
    );

    await create2Deployer.deploy(
      testSalt,
      Create2Deployer.bytecode
    );
    
    let secondDeployer = Create2Deployer.attach(calculatedAddress);

    expect(calculatedAddress).to.equal(
      await secondDeployer.addressFrom(
        create2Deployer.address,
        testSalt,
        Create2Deployer.bytecode
      )
    );

  });

  it('should fail deployment with same salt', async function () {
    let testSalt = "1";
    let deployerPromise1, deployerPromise2 = create2Deployer.deploy(
      testSalt,
      Create2Deployer.bytecode
    );
    
    await deployerPromise1;

    expectRevert.unspecified(deployerPromise2);
  })
});
