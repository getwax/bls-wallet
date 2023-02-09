import { ethers } from "hardhat";
import { utils, BigNumber, Signer } from "ethers";
import { BlsWalletWrapper } from "../../clients/src";

import Fixture from "./Fixture";
/* eslint-disable camelcase */
import { IERC20, MockERC20__factory } from "../../typechain-types";

export default class TokenHelper {
  static readonly initialSupply = utils.parseUnits("1000000");
  readonly userStartAmount: BigNumber;

  testToken: IERC20 | undefined;
  constructor(public fx: Fixture) {
    this.userStartAmount = TokenHelper.initialSupply.div(
      // +1 to keep some tokens for the aggregator
      fx.lazyBlsWallets.length + 1,
    );
    this.testToken = undefined;
  }

  /// @dev Contract deployed by first ethers signer, has initial supply
  static async deployTestToken(
    balanceAddress: string | undefined = undefined,
  ): Promise<IERC20> {
    const [signer] = await ethers.getSigners();
    const mockERC20 = await new MockERC20__factory(signer).deploy(
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
    token: IERC20,
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
    );
  }
}
