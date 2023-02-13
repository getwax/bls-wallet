import { ContractTransaction } from "ethers";
import { getTransferAmount } from "../token";
import {
  GasMeasurementContext,
  GasMeasurementTransactionConfig,
} from "../types";

const createNormalTransfer = async (
  ctx: GasMeasurementContext,
): Promise<ContractTransaction[]> => {
  const txns: ContractTransaction[] = [];

  for (let i = 0; i < ctx.numTransactions; i++) {
    const walletIdx = ctx.rng.int(0, ctx.blsWallets.length);
    const blsWallet = ctx.blsWallets[walletIdx];

    const toAddress = ctx.rng.item(ctx.blsWallets, [blsWallet]).address;
    const amount = getTransferAmount(ctx);

    const tx = await ctx.contracts.testToken
      .connect(ctx.eoaSigner)
      .transfer(toAddress, amount);
    txns.push(tx);
  }

  return txns;
};

/**
 * Runs ERC20 transfers in a normal eth transaction
 */
export const normalTransferConfig: GasMeasurementTransactionConfig = {
  type: "transfer",
  mode: "normal",
  factoryFunc: createNormalTransfer,
};
