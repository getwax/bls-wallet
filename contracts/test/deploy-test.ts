import { expect, assert } from "chai";
import expectRevert from "../shared/helpers/expectRevert";

import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";
import deployerContract, {
  defaultDeployerAddress,
  defaultDeployerWallet,
} from "../shared/helpers/deployDeployer";
import { Create2Deployer, Create2Deployer__factory } from "../typechain";
import { ContractFactory } from "@ethersproject/contracts";

describe("Deployer", async function () {
  let deployerSigner;
  let eoaAddress;
  let Create2Deployer: ContractFactory;
  let create2Deployer: Create2Deployer;
  this.beforeAll(async function () {
    Create2Deployer = await ethers.getContractFactory(
      "Create2Deployer",
      defaultDeployerWallet(),
    );

    // fund deployer wallet address
    const fundedSigner = (await ethers.getSigners())[0];
    await (
      await fundedSigner.sendTransaction({
        to: defaultDeployerAddress(),
        value: ethers.utils.parseEther("1"),
      })
    ).wait();

    // one-time deployment
    create2Deployer = await deployerContract();
  });

  beforeEach(async function () {});

  it("should deploy to caculated (create2) address", async function () {
    const testSalt = BigNumber.from(0);
    const initCodeHash = ethers.utils.solidityKeccak256(
      ["bytes"],
      [Create2Deployer.bytecode],
    );
    const calculatedAddress = ethers.utils.getCreate2Address(
      create2Deployer.address,
      "0x" + testSalt.toHexString().substr(2).padStart(64, "0"),
      initCodeHash,
    );
    expect(calculatedAddress).to.equal(
      await create2Deployer.addressFrom(
        create2Deployer.address,
        testSalt,
        Create2Deployer.bytecode,
      ),
    );

    await create2Deployer.deploy(testSalt, Create2Deployer.bytecode);

    const secondDeployer = Create2Deployer.attach(calculatedAddress);

    expect(calculatedAddress).to.equal(
      await secondDeployer.addressFrom(
        create2Deployer.address,
        testSalt,
        Create2Deployer.bytecode,
      ),
    );
  });

  it("should fail deployment with same salt", async function () {
    const testSalt = BigNumber.from(1);
    // two identical deployment promises, ie, same create2 address
    await create2Deployer.deploy(testSalt, Create2Deployer.bytecode);
    await expectRevert(
      create2Deployer.deploy(testSalt, Create2Deployer.bytecode),
    );
  });
});
