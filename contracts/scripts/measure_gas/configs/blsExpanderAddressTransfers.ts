import { ContractTransaction } from "ethers";
import { Bundle } from "../../../clients/src";
import { createTransferAction } from "../token";
import {
  GasMeasurementContext,
  GasMeasurementTransactionConfig,
} from "../types";

const createBlsExpanderAddressTransfers = async (
  ctx: GasMeasurementContext,
): Promise<ContractTransaction[]> => {
  const bundles: Bundle[] = [];
  const walletAddresses: string[] = [];
  const walletNonces = await Promise.all(
    ctx.blsWallets.map(async (w) => {
      const n = await w.Nonce();
      return n.toNumber();
    }),
  );

  for (let i = 0; i < ctx.numTransactions; i++) {
    const walletIdx = ctx.rng.int(0, ctx.blsWallets.length);
    const blsWallet = ctx.blsWallets[walletIdx];

    const toAddress = ctx.rng.item(ctx.blsWallets, [blsWallet]).address;

    const nonce = walletNonces[walletIdx]++;
    const bundle = blsWallet.sign({
      nonce,
      actions: [createTransferAction(ctx, toAddress)],
    });

    bundles.push(bundle);
    walletAddresses.push(blsWallet.address);
  }

  const aggBundle = ctx.blsWallets[0].blsWalletSigner.aggregate(bundles);

  // Register pubkeys. Ideally, those would be stored on the VG or wallet.
  // We should also de-dupe these, but doesn't matter for bundle gas measurement.
  console.log("registering public keys...");
  const { senderPublicKeys, ...bundleOmitPubKeys } = aggBundle;
  const registerTxn = await ctx.contracts.blsExpander
    .connect(ctx.eoaSigner)
    .registerPublicKeys(walletAddresses, senderPublicKeys);
  await registerTxn.wait();
  console.log("public keys registered");

  // Create hashed bundle
  const hashedBundle = {
    ...bundleOmitPubKeys,
    senderAddresses: walletAddresses,
  };

  const txn = await ctx.contracts.blsExpander
    .connect(ctx.eoaSigner)
    .addressProcessBundle(hashedBundle);
  return [txn];
};

/**
 * Runs ERC20 transfers as a single bundle through the expander contract to reduce calldata size
 */
export const blsExpanderAddressTransferConfig: GasMeasurementTransactionConfig =
  {
    type: "transfer",
    mode: "blsExpanderAddress",
    factoryFunc: createBlsExpanderAddressTransfers,
  };
