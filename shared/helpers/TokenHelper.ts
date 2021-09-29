import { ethers } from "hardhat";
import { utils } from "ethers";
import { BigNumber, Signer, Contract, ContractFactory, getDefaultProvider } from "ethers";

import { BlsSignerFactory, BlsSignerInterface, aggregate } from "../lib/hubble-bls/src/signer";

import blsSignFunction from "./blsSignFunction";
import Fixture, { FullTxData } from "./Fixture";

export default class TokenHelper {

  static readonly initialSupply = utils.parseUnits("1000000")
  readonly userStartAmount: BigNumber;

  testToken: Contract;
  constructor(public fx: Fixture) { 
    this.userStartAmount = TokenHelper.initialSupply.div(fx.blsSigners.length);
  }

  /// @dev Contract deployed by first ethers signer, has initial supply
  static async deployTestToken(balanceAddress:string=null): Promise<Contract> {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    let mockERC20 = await MockERC20.deploy(
      "AnyToken",
      "TOK",
      TokenHelper.initialSupply
    );
    await mockERC20.deployed();

    if (balanceAddress) {
      await mockERC20.transfer(
        balanceAddress,
        TokenHelper.initialSupply
      );
    }

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
    let fullTxData: FullTxData = {
      blsSigner: sender,
      chainId: this.fx.chainId,
      nonce: nonce,
      rewardRecipient: ethers.constants.AddressZero,
      rewardAmount: reward,
      ethValue: BigNumber.from(0),
      contract: this.testToken,
      functionName: "transfer",
      params: [recipient, amount]
    }
    this.fx.gatewayCallFull(fullTxData);
  }
}
