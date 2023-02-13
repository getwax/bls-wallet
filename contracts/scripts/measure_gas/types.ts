import { ContractTransaction, providers, Signer } from "ethers";
import Web3 from "web3";
import { BlsWalletContracts, BlsWalletWrapper } from "../../clients/src";
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
  contracts: BlsWalletContracts;
  provider: providers.Provider;
  eoaSigner: Signer;
  rng: Rng;
  blsWallets: BlsWalletWrapper[];
  numTransactions: number;
  web3Provider: Web3;
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
  numTokensPerWallet: number;
  networkConfigName?: string;
  transactionBatches: number[];
  transactionConfigs: GasMeasurementTransactionConfig[];
}>;

export type GasMeasurementResult = Readonly<{
  config: GasMeasurementConfig;
  eoaSignerAddress: string;
  blsWalletAddresses: string[];
  measurements: Array<GasMeasurement | GasMeasurementError>;
}>;
