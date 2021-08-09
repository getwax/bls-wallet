import { blsSignerFactory } from "../../deps/index.ts";
import WalletService from "../../src/app/WalletService.ts";
import createBLSWallet from "../../src/chain/createBLSWallet.ts";
import domain from "../../src/chain/domain.ts";
import * as env from "../../src/env.ts";
import Rng from "../../src/helpers/Rng.ts";

export default async function createTestWallet(seed = Rng.generateSeed()) {
  const walletService = new WalletService(env.PRIVATE_KEY_AGG);

  const network = await walletService.aggregatorSigner.provider.getNetwork();

  const blsSecret = Rng.root.seed(seed, "blsSecret").address();

  const signer = blsSignerFactory.getSigner(domain, blsSecret);

  const walletAddress = await createBLSWallet(
    network.chainId,
    walletService.verificationGateway,
    signer,
  );

  return {
    seed,
    blsSecret,
    walletAddress,
  };
}
