import { ethers } from "hardhat";
import { utils, BigNumber, Signer, Contract } from "ethers";
import { BlsWalletWrapper } from "../../clients/src";

import Fixture from "./Fixture";

export default class TokenHelper {
  static readonly initialSupply = utils.parseUnits("1000000");
  readonly userStartAmount: BigNumber;

  testToken: Contract | undefined;
  constructor(public fx: Fixture) {
    this.userStartAmount = TokenHelper.initialSupply.div(
      fx.lazyBlsWallets.length,
    );
    this.testToken = undefined;
  }

  /// @dev Contract deployed by first ethers signer, has initial supply
  static async deployTestToken(
    balanceAddress: string | undefined = undefined,
  ): Promise<Contract> {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockERC20 = await MockERC20.deploy(
      "AnyToken",
      "TOK",
      TokenHelper.initialSupply,
    );
    await mockERC20.deployed();

    if (balanceAddress) {
      await mockERC20.transfer(balanceAddress, TokenHelper.initialSupply);
    }

    return mockERC20;
  }

  async distributeTokens(
    fromSigner: Signer,
    token: Contract,
    wallets: BlsWalletWrapper[],
  ) {
    const length = wallets.length;

    // split supply amongst bls wallet addresses
    for (let i = 0; i < length; i++) {
      // first account as aggregator, and holds token supply
      await (
        await token
          .connect(fromSigner)
          .transfer(wallets[i].address, this.userStartAmount)
      ).wait();
    }
  }

  async walletTokenSetup(): Promise<BlsWalletWrapper[]> {
    const wallets = await this.fx.createBLSWallets();

    this.testToken = await TokenHelper.deployTestToken();
    await this.distributeTokens(this.fx.signers[0], this.testToken, wallets);

    return wallets;
  }

  async transferFrom(
    nonce: BigNumber,
    sender: BlsWalletWrapper,
    recipient: string,
    amount: BigNumber,
  ) {
    await this.fx.verificationGateway.processBundle(
      this.fx.blsWalletSigner.aggregate([
        sender.sign({
          nonce,
          actions: [
            {
              ethValue: BigNumber.from(0),
              contractAddress: this.testToken.address,
              encodedFunction: this.testToken.interface.encodeFunctionData(
                "transfer",
                [recipient, amount.toHexString()],
              ),
            },
          ],
        }),
      ]),
    );
  }
}
