import { BigNumber, Signer, utils } from "ethers";
import { ActionData } from "../../clients/src";
// eslint-disable-next-line camelcase
import { IERC20, MockERC20__factory } from "../../typechain-types";
import { GasMeasurementContext } from "./types";

export const TOKEN = {
  name: "HotPotato",
  symbol: "HP",
};

export const deployToken = async (
  signer: Signer,
  tokenSupply: number,
): Promise<IERC20> => {
  const supply = utils.parseUnits(tokenSupply.toString());
  const erc20Token = await new MockERC20__factory(signer).deploy(
    "HotPotato",
    "HP",
    supply,
  );
  await erc20Token.deployed();
  return erc20Token;
};

export const distributeToken = async (
  signer: Signer,
  erc20Token: IERC20,
  walletAddresses: string[],
): Promise<void> => {
  const supply = await erc20Token.totalSupply();
  const transferAmount = supply.div(walletAddresses.length * 2); // keep some for first signer
  const tokenTransferTxns = await walletAddresses.reduce(async (acc, addr) => {
    const txns = await acc;
    const tx = await erc20Token.connect(signer).transfer(addr, transferAmount);
    return [...txns, tx];
  }, Promise.resolve([]));
  await Promise.all(tokenTransferTxns.map(async (tx) => tx.wait()));
};

export const getTransferAmount = (ctx: GasMeasurementContext): BigNumber => {
  return BigNumber.from(ctx.rng.int(1, ctx.blsWallets.length));
};

export const createTransferAction = (
  ctx: GasMeasurementContext,
  to: string,
): ActionData => ({
  contractAddress: ctx.erc20Token.address,
  encodedFunction: ctx.erc20Token.interface.encodeFunctionData("transfer", [
    to,
    getTransferAmount(ctx),
  ]),
  ethValue: 0,
});
