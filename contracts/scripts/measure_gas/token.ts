import { BigNumber, Signer } from "ethers";
import {
  ActionData,
  BlsWalletContracts,
  BlsWalletWrapper,
} from "../../clients/src";
import { MockERC20 } from "../../typechain-types";
import { processBundles } from "./transaction";
import { GasMeasurementContext } from "./types";

export const getTransferAmount = (ctx: GasMeasurementContext): BigNumber => {
  return BigNumber.from(ctx.rng.int(1, ctx.blsWallets.length));
};

export const createTransferAction = (
  ctx: GasMeasurementContext,
  to: string,
): ActionData => ({
  contractAddress: ctx.contracts.testToken.address,
  encodedFunction: ctx.contracts.testToken.interface.encodeFunctionData(
    "transfer",
    [to, getTransferAmount(ctx)],
  ),
  ethValue: 0,
});

export const createMintAction = (
  erc20Token: MockERC20,
  to: string,
  amount: number,
): ActionData => ({
  contractAddress: erc20Token.address,
  encodedFunction: erc20Token.interface.encodeFunctionData("mint", [
    to,
    amount,
  ]),
  ethValue: 0,
});

export const mintTokens = async (
  { testToken, verificationGateway }: BlsWalletContracts,
  eoaSigner: Signer,
  wallets: BlsWalletWrapper[],
  amountPerWallet: number,
): Promise<void> => {
  // Mint tokens for EOA signer
  const eoaSignerAddress = await eoaSigner.getAddress();
  const txn = await testToken
    .connect(eoaSigner)
    .mint(eoaSignerAddress, amountPerWallet);
  await txn.wait();

  // Mint tokens for BLS wallets
  const mintBundles = await Promise.all(
    wallets.map(async (w) =>
      w.sign({
        nonce: await w.Nonce(),
        actions: [createMintAction(testToken, w.address, amountPerWallet)],
      }),
    ),
  );
  await processBundles(
    verificationGateway,
    eoaSigner,
    wallets[0].blsWalletSigner,
    mintBundles,
  );
};
