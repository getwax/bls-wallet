import { ContractTransaction } from "ethers";
import { solidityPack } from "ethers/lib/utils";
import { createTransferAction } from "../token";
import {
  GasMeasurementContext,
  GasMeasurementTransactionConfig,
} from "../types";

const createBlsExpanderAirdrop = async (
  ctx: GasMeasurementContext,
): Promise<ContractTransaction[]> => {
  const sendingWallet = ctx.rng.item(ctx.blsWallets);

  const actions = [];

  for (let i = 0; i < ctx.numTransactions; i++) {
    const toAddress = ctx.rng.item(ctx.blsWallets, [sendingWallet]).address;
    actions.push(createTransferAction(ctx, toAddress));
  }

  const operation = {
    nonce: await sendingWallet.Nonce(),
    actions,
  };
  const bundle = sendingWallet.sign(operation);

  const encodedFunction = solidityPack(
    ["bytes"],
    [operation.actions[0].encodedFunction],
  );
  const methodId = encodedFunction.slice(0, 10);
  const encodedParamSets = operation.actions.map(
    (a) => `0x${a.encodedFunction.slice(10)}`,
  );

  const txn = await ctx.contracts.blsExpander
    .connect(ctx.eoaSigner)
    .blsCallMultiSameCallerContractFunction(
      sendingWallet.PublicKey(),
      operation.nonce,
      bundle.signature,
      ctx.contracts.testToken.address,
      methodId,
      encodedParamSets,
    );
  return [txn];
};

/**
 * Runs an ERC20 airdrop using expander contract
 */
export const blsExpanderAirdropConfig: GasMeasurementTransactionConfig = {
  type: "transfer",
  mode: "blsExpanderAirdrop",
  factoryFunc: createBlsExpanderAirdrop,
};
