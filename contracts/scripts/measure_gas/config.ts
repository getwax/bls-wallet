import { GasMeasurementConfig } from "./types";

export class ConfigError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ConfigError";
  }
}

export const validateConfig = (cfg: GasMeasurementConfig) => {
  if (!cfg.numBlsWallets) {
    throw new ConfigError(`numBlsWallets < 1`);
  }
  if (!cfg.transactionBatches.length) {
    throw new ConfigError(`transactionBatches len < 1`);
  }
  if (!cfg.transactionConfigs.length) {
    throw new ConfigError(`transactionConfigs len < 1`);
  }
};
