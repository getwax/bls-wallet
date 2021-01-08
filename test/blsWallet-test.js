const { expect } = require("chai");
const { ethers } = require("hardhat");

const acc1BLSPubKey = [0xAA, 0xBB, 0xCC, 0xDD];
const acc2BLSPubKey = [0xEE, 0xFF, 0x00, 0x11];
const initialSupply = ethers.utils.parseUnits("1000000")

describe('BLSWallet', async function () {
  beforeEach(async function () {
    [admin, account1, account2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    this.baseToken = await MockERC20.deploy("AnyToken","TOK", initialSupply);

    const BLSWallet = await ethers.getContractFactory("BLSWallet");
    this.blsWallet = await BLSWallet.deploy(this.baseToken.address);
  });

  it('should ', async function () {
    await this.blsWallet.connect(account1).deposit(acc1BLSPubKey, 0);
  });
});
