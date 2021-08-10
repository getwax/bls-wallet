import { blsSignerFactory, ethers } from "../../deps/index.ts";
import WalletService from "../../src/app/WalletService.ts";
import createBLSWallet from "../../src/chain/createBLSWallet.ts";
import domain from "../../src/chain/domain.ts";
import * as env from "../../test/env.ts";
import Rng from "../../src/helpers/Rng.ts";
import MockErc20 from "../../test/helpers/MockErc20.ts";

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

  const testErc20 = new MockErc20(
    env.TEST_TOKEN_ADDRESS,
    walletService.aggregatorSigner,
  );

  await testErc20.mint(walletAddress, ethers.BigNumber.from(10).pow(18));

  return {
    seed,
    blsSecret,
    walletAddress,
  };
}
