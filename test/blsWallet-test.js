const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const utils = ethers.utils;

const acc1BLSPubKey = [0xAA, 0xBB, 0xCC, 0xDD].map((n) => { return BigNumber.from(n) });
const acc2BLSPubKey = [0xEE, 0xFF, 0x00, 0x11].map((n) => { return BigNumber.from(n) });
const zeroBLSPubKey = [0, 0, 0, 0].map((n) => { return BigNumber.from(n) });

const initialSupply = ethers.utils.parseUnits("1000000")
const userStartAmount = initialSupply.div(2);

describe('BLSWallet', async function () {
  beforeEach(async function () {
    [admin, account1, account2] = await ethers.getSigners();

    // setup erc20 token and account balances
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    this.baseToken = await MockERC20.deploy("AnyToken","TOK", initialSupply);
    await this.baseToken.deployed();
    await this.baseToken.transfer(account1.address, userStartAmount);
    await this.baseToken.transfer(account2.address, userStartAmount);

    // deploy bls wallet with token address
    const BLSWallet = await ethers.getContractFactory("MockBLSWallet");
    this.blsWallet = await BLSWallet.deploy(this.baseToken.address);
    await this.blsWallet.deployed();

    // approve bls wallet with amount to transfer
    await this.baseToken.connect(account1).approve(this.blsWallet.address, userStartAmount);
    await this.baseToken.connect(account2).approve(this.blsWallet.address, userStartAmount);
  });

  it('should deposit balance from token to bls wallet', async function () {
    await this.blsWallet.connect(account1).deposit(acc1BLSPubKey, userStartAmount);
    expect(await this.blsWallet.balanceOf(account1.address)).to.equal(userStartAmount);
  });

  it('should set bls public key on deposit', async function () {
    await this.blsWallet.connect(account1).deposit(acc1BLSPubKey, userStartAmount);
    expect(await this.blsWallet.blsPubKeyOf(account1.address)).to.eql(acc1BLSPubKey);
  });

  it('should withdraw full balance from token to bls wallet', async function () {
    await this.blsWallet.connect(account1).withdraw();
    expect(await this.blsWallet.balanceOf(account1.address)).to.equal(0);
  });

  it('should reset bls public key on withdraw', async function () {
    await this.blsWallet.connect(account1).withdraw();
    expect(await this.blsWallet.blsPubKeyOf(account1.address)).to.eql(zeroBLSPubKey);
  });

});
