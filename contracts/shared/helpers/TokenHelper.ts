import { ethers } from "hardhat";
import { utils } from "ethers";
import { BigNumber, Signer, Contract, ContractFactory, getDefaultProvider } from "ethers";
import { BlsWallet } from "bls-wallet-clients";

import Fixture from "./Fixture";

export default class TokenHelper {

  static readonly initialSupply = utils.parseUnits("1000000")
  readonly userStartAmount: BigNumber;

  testToken: Contract|undefined;
  constructor(public fx: Fixture) { 
    this.userStartAmount = TokenHelper.initialSupply.div(fx.lazyBlsWallets.length);
    this.testToken = undefined;
  }

  /// @dev Contract deployed by first ethers signer, has initial supply
  static async deployTestToken(balanceAddress:string|undefined=undefined): Promise<Contract> {
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
    wallets: BlsWallet[]
  ) {
    const length = wallets.length;
    
    // split supply amongst bls wallet addresses
    for (let i = 0; i < length; i++) {
      // first account as aggregator, and holds token supply
      await (await token.connect(fromSigner).transfer(
        wallets[i].address,
        this.userStartAmount
      )).wait();
    }
  }

  async walletTokenSetup(): Promise<BlsWallet[]> {
    let wallets = await this.fx.createBLSWallets();

    this.testToken = await TokenHelper.deployTestToken();
    await this.distributeTokens(
      this.fx.signers[0],
      this.testToken,
      wallets,
    );

    return wallets;
  }

  async transferFrom(
    nonce: BigNumber,
    sender: BlsWallet,
    recipient: string,
    amount: BigNumber,
  ) {
    await this.fx.verificationGateway.actionCalls(
      this.fx.blsWalletSigner.aggregate([
        sender.sign({
          nonce,
          actions: [
            {
              contract: this.testToken,
              method: "transfer",
              args: [recipient, amount.toHexString()],
            },
          ],
        }),
      ]),
    );
  }
}
