import { ethers } from "hardhat";
import { BigNumber, Signer, Contract, ContractFactory, getDefaultProvider } from "ethers";

import { BlsSignerFactory, BlsSignerInterface, aggregate } from "../lib/hubble-bls/src/signer";

import Fixture from "./Fixture";

export default class TokenHelper {

  static readonly initialSupply = ethers.utils.parseUnits("1000000")
  static readonly userStartAmount = TokenHelper.initialSupply.div(Fixture.ACCOUNTS_LENGTH);

  testToken: Contract;
  constructor(public fx: Fixture) { }

  static async setupTestToken(): Promise<Contract> {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    let mockERC20 = await MockERC20.deploy(
      "AnyToken",
      "TOK",
      TokenHelper.initialSupply
    );
    await mockERC20.deployed();
    return mockERC20;
  }

  static async distributeTokens(
    fromSigner: Signer,
    token: Contract,
    addresses: string[]
  ) {
    console.log("Distribute tokens to wallets...");
    // split supply amongst bls wallet addresses
    for (let i = 0; i < addresses.length; i++) {
      // first account as aggregator, and holds token supply
      await (await token.connect(fromSigner).transfer(
        addresses[i],
        TokenHelper.userStartAmount
      )).wait();
    }
  }

  async walletTokenSetup(): Promise<string[]> {
    let blsWalletAddresses = await this.fx.createBLSWallets();

    this.testToken = await TokenHelper.setupTestToken();
    await TokenHelper.distributeTokens(
      this.fx.signers[0],
      this.testToken,
      blsWalletAddresses
    );

    return blsWalletAddresses;
  }

  async transferFrom(
    reward: BigNumber,
    nonce: any,
    sender: BlsSignerInterface,
    recipient: string,
    amount: BigNumber
  ) {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    let encodedFunction = MockERC20.interface.encodeFunctionData(
      "transfer",
      [recipient, amount.toString()]
    );
    await this.fx.gatewayCall(
      reward,
      sender,
      nonce,
      this.testToken.address,
      encodedFunction
    );
  }
}
