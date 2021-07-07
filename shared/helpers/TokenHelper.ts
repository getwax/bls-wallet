import { ethers } from "hardhat";
import { BigNumber, Signer, Contract, ContractFactory, getDefaultProvider } from "ethers";

import { BlsSignerFactory, BlsSignerInterface, aggregate } from "../lib/hubble-bls/src/signer";

import Fixture from "./Fixture";

export default class TokenHelper {

  static readonly initialSupply = ethers.utils.parseUnits("1000000")
  readonly userStartAmount;

  testToken: Contract;
  constructor(public fx: Fixture) { 
    this.userStartAmount = TokenHelper.initialSupply.div(fx.blsSigners.length);
  }

  /// @dev Contract deployed by first ethers signer, has initial supply
  static async deployTestToken(): Promise<Contract> {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    let mockERC20 = await MockERC20.deploy(
      "AnyToken",
      "TOK",
      TokenHelper.initialSupply
    );
    await mockERC20.deployed();
    return mockERC20;
  }

  async distributeTokens(
    fromSigner: Signer,
    token: Contract,
    addresses: string[]
  ) {
    const length = addresses.length;
    
    // split supply amongst bls wallet addresses
    for (let i = 0; i < length; i++) {
      // first account as aggregator, and holds token supply
      await (await token.connect(fromSigner).transfer(
        addresses[i],
        this.userStartAmount
      )).wait();
    }
  }

  async walletTokenSetup(): Promise<string[]> {
    let blsWalletAddresses = await this.fx.createBLSWallets();

    this.testToken = await TokenHelper.deployTestToken();
    await this.distributeTokens(
      this.fx.signers[0],
      this.testToken,
      blsWalletAddresses
    );

    return blsWalletAddresses;
  }

  async transferFrom(
    nonce: any,
    reward: BigNumber,
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
      sender,
      nonce,
      reward,
      this.testToken.address,
      encodedFunction
    );
  }
}
