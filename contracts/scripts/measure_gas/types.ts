import { ContractTransaction, Signer } from "ethers";
import Web3 from "web3";
import { BlsWalletWrapper } from "../../clients/src";
import Fixture from "../../shared/helpers/Fixture";
import { IERC20 } from "../../typechain-types";
import { Rng } from "./rng";

export type TransactionType = "transfer" | "approveAndSwap";
export type TransactionMode =
  | "normal"
  | "bls"
  | "blsExpanderAirdrop"
  | "blsExpanderAddress";

export type ArbitrumGasMeasurement = {
  gasUsedForL1: number;
};

export type GasMeasurement = Readonly<{
  transactions: {
    count: number;
    type: TransactionType;
    mode: TransactionMode;
    hashes: string[];
    totalSizeBytes: number;
  };
  gas: {
    used: number;
    price: number;
    arbitrum?: ArbitrumGasMeasurement;
  };
}>;

export type GasMeasurementError = Readonly<{
  numTransactions: number;
  transaction: {
    type: TransactionType;
    mode: TransactionMode;
  };
  error: string;
}>;

export type GasMeasurementContext = Readonly<{
  fx: Fixture;
  eoaSigner: Signer;
  rng: Rng;
  blsWallets: BlsWalletWrapper[];
  numTransactions: number;
  web3Provider: Web3;
  erc20Token: IERC20;
}>;
export type InitialContext = Omit<GasMeasurementContext, "numTransactions">;

export type GasMeasurementTransactionConfig = Readonly<{
  mode: TransactionMode;
  type: TransactionType;
  factoryFunc: (ctx: GasMeasurementContext) => Promise<ContractTransaction[]>;
}>;

export type GasMeasurementConfig = Readonly<{
  seed: string;
  numBlsWallets: number;
  tokenSupply: number;
  transactionBatches: number[];
  transactionConfigs: GasMeasurementTransactionConfig[];
  delayBetweenMeasurementsSeconds: number;
}>;

export type GasMeasurementResult = Readonly<{
  config: GasMeasurementConfig;
  eoaSignerAddress: string;
  blsWalletAddresses: string[];
  measurements: Array<GasMeasurement | GasMeasurementError>;
}>;
