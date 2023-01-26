import { ContractTransaction } from "ethers";
import { Bundle } from "../../../clients/src";
import { createTransferAction } from "../token";
import {
  GasMeasurementContext,
  GasMeasurementTransactionConfig,
} from "../types";

export const createBlsExpanderAddressTransfers = async (
  ctx: GasMeasurementContext,
): Promise<ContractTransaction[]> => {
  const signer = ctx.fx.signers[0];

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

  const aggBundle = ctx.fx.blsWalletSigner.aggregate(bundles);

  // Register pubkeys. Ideally, those would be stored on the VG or wallet.
  // We should also de-dupe these, but doesn't matter for bundle gas measurement.
  console.log("registering public keys...");
  const { senderPublicKeys, ...bundleOmitPubKeys } = aggBundle;
  const registerTxn = await ctx.fx.blsExpander
    .connect(signer)
    .registerPublicKeys(walletAddresses, senderPublicKeys);
  await registerTxn.wait();
  console.log("public keys registered");

  // Create hashed bundle
  const hashedBundle = {
    ...bundleOmitPubKeys,
    senderAddresses: walletAddresses,
  };

  const txn = await ctx.fx.blsExpander
    .connect(signer)
    .addressProcessBundle(hashedBundle);
  return [txn];
};

export const blsExpanderAddressTransferConfig: GasMeasurementTransactionConfig =
  {
    type: "transfer",
    mode: "blsExpanderAddress",
    factoryFunc: createBlsExpanderAddressTransfers,
  };
