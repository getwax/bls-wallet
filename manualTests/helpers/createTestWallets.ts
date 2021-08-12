import { blsSignerFactory, ethers } from "../../deps/index.ts";
import createBLSWallet from "../../src/chain/createBLSWallet.ts";
import domain from "../../src/chain/domain.ts";
import * as env from "../../test/env.ts";
import Rng from "../../src/helpers/Rng.ts";
import MockErc20 from "../../test/helpers/MockErc20.ts";
import Range from "../../src/helpers/Range.ts";
import Signer from "../../test/helpers/Signer.ts";
import ovmContractABIs from "../../ovmContractABIs/index.ts";

export default async function createTestWallets(
  provider: ethers.providers.Provider,
  count: number,
  seed = Rng.generateSeed(),
) {
  const rng = Rng.root.seed(seed);
  const signer = Signer(provider, env.PRIVATE_KEY_AGG);
  const network = await provider.getNetwork();

  const verificationGateway = new ethers.Contract(
    env.VERIFICATION_GATEWAY_ADDRESS,
    ovmContractABIs["VerificationGateway.json"].abi,
    signer,
  );

  const wallets: { blsSecret: string; walletAddress: string }[] = [];

  console.log("Creating wallets...");

  for (const i of Range(count)) {
    const blsSecret = rng.seed(`blsSecret${i}`).address();

    const blsSigner = blsSignerFactory.getSigner(domain, blsSecret);

    const walletAddress = await createBLSWallet(
      network.chainId,
      verificationGateway,
      blsSigner,
    );

    const testErc20 = new MockErc20(
      env.TEST_TOKEN_ADDRESS,
      signer,
    );

    await testErc20.mint(walletAddress, ethers.BigNumber.from(10).pow(18));

    wallets.push({ blsSecret, walletAddress });
    console.log(wallets.length, "wallets");
  }

  return { seed, wallets };
}
