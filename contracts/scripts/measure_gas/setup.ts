import { providers, Wallet } from "ethers";
import { network } from "hardhat";
import { HttpNetworkConfig } from "hardhat/types";
import Web3 from "web3";
import { BlsWalletWrapper, connectToContracts } from "../../clients/src";
import getNetworkConfig from "../../shared/helpers/getNetworkConfig";
import { Rng } from "./rng";
import { mintTokens } from "./token";
import { GasMeasurementConfig, InitialContext } from "./types";

const generatePrivateKey = (rng: Rng): string => {
  const secretNum = Math.abs((rng.random() * 0xffffffff) << 0);
  return `0x${secretNum.toString(16)}`;
};

const inferNetCfgName = (): string => {
  if (network.name === "gethDev") {
    return "local";
  }

  return network.name.replace("-", "_");
};

export const init = async (
  cfg: GasMeasurementConfig,
): Promise<InitialContext> => {
  const rng = new Rng(cfg.seed);
  const walletPrivateKeys = Array.from(new Array(cfg.numBlsWallets), () =>
    generatePrivateKey(rng),
  );

  const { url } = network.config as HttpNetworkConfig;
  if (!url) {
    throw new Error("ethers.js network config does not have url");
  }
  const provider = new providers.JsonRpcProvider({
    url,
    throttleLimit: 20,
    throttleSlotInterval: 1000,
  });
  const eoaSigner = Wallet.fromMnemonic(process.env.MAIN_MNEMONIC).connect(
    provider,
  );

  const netCfg = await getNetworkConfig(
    cfg.networkConfigName ?? inferNetCfgName(),
  );
  const contracts = await connectToContracts(provider, netCfg);

  const blsWallets = await Promise.all(
    walletPrivateKeys.map(async (privKey) =>
      BlsWalletWrapper.connect(
        privKey,
        contracts.verificationGateway.address,
        provider,
      ),
    ),
  );

  /**
   * This will also create any new wallets before
   * first measurement, so extra cost does not skew results.
   */
  await mintTokens(contracts, eoaSigner, blsWallets, cfg.numTokensPerWallet);

  /**
   * Web3 needs to be used over ethers.js since its transaction
   * receipts do not have the 'gasUsedForL1' property stripped out.
   */
  const web3Provider = new Web3(url);

  return {
    contracts,
    provider,
    eoaSigner,
    rng,
    blsWallets,
    web3Provider,
  };
};
