import { network } from "hardhat";
import { HttpNetworkConfig } from "hardhat/types";
import Web3 from "web3";
import { BlsWalletWrapper, getOperationResults } from "../../clients/src";
import Fixture from "../../shared/helpers/Fixture";
import { Rng } from "./rng";
import { deployToken, distributeToken } from "./token";
import { GasMeasurementConfig, InitialContext } from "./types";

const generatePrivateKey = (rng: Rng): string => {
  const secretNum = Math.abs((rng.random() * 0xffffffff) << 0);
  return `0x${secretNum.toString(16)}`;
};

const initWallets = async (
  fx: Fixture,
  wallets: BlsWalletWrapper[],
): Promise<void> => {
  console.log("initializing BLS Wallets...");

  const walletsWithoutNonces = await Promise.all(
    wallets.map(async (w) => {
      const nonce = await w.Nonce();
      if (nonce.gt(0)) {
        return undefined;
      }
      return w;
    }),
  );
  const uninitializedWallets = walletsWithoutNonces.filter((w) => w);
  if (!uninitializedWallets.length) {
    console.log("all BLS Wallets already initialized");
    return;
  }

  const initBundles = await uninitializedWallets.map((w) =>
    w.sign({
      nonce: 0,
      actions: [],
    }),
  );
  const aggBundle = wallets[0].blsWalletSigner.aggregate(initBundles);

  const txn = await fx.verificationGateway.processBundle(aggBundle);
  const txnReceipt = await txn.wait();
  const results = getOperationResults(txnReceipt);

  const errors = results
    .filter((r) => r.error)
    .map(({ error: err }) => `${err.actionIndex}: ${err.message}`);
  if (errors.length) {
    const uninitializedWalletAddresses = uninitializedWallets.map(
      (w) => w.address,
    );
    throw new Error(
      `failed to initilaize wallets [${uninitializedWalletAddresses.join(
        ", ",
      )}]: [${errors.join(", ")}]`,
    );
  }

  console.log(`${initBundles.length} BLS Wallets initialized`);
};

export const init = async (
  cfg: GasMeasurementConfig,
): Promise<InitialContext> => {
  const rng = new Rng(cfg.seed);
  const fx = await Fixture.create(0);
  const [eoaSigner] = fx.signers;

  const walletPrivateKeys = Array.from(new Array(cfg.numBlsWallets), () =>
    generatePrivateKey(rng),
  );

  const blsWallets = await Promise.all(
    walletPrivateKeys.map(async (privKey) =>
      BlsWalletWrapper.connect(
        privKey,
        fx.verificationGateway.address,
        fx.provider,
      ),
    ),
  );
  const walletAddresses = blsWallets.map((w) => w.address);

  /**
   * Create all wallets before first measurement
   * so extra cost does not skew results.
   */
  await initWallets(fx, blsWallets);

  const erc20Token = await deployToken(eoaSigner, cfg.tokenSupply);
  console.log(`token deployed to ${erc20Token.address}`);
  await distributeToken(eoaSigner, erc20Token, walletAddresses);
  console.log("token distributed to BLS Wallets");

  /**
   * Web3 needs to be used over ethers.js since its transaction
   * receipts do not have the 'gasUsedForL1' property stripped out.
   */
  const { url: rpcUrl } = network.config as HttpNetworkConfig;
  if (!rpcUrl) {
    throw new Error("ethers.js network config does not have url");
  }
  const web3Provider = new Web3(rpcUrl);

  return {
    fx,
    eoaSigner,
    rng,
    blsWallets,
    web3Provider,
    erc20Token,
  };
};
