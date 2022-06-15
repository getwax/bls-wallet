export interface CurrencyControllerConfig {
  pollInterval: number;
  api?: string;
}

export const defaultCurrencyControllerConfig: CurrencyControllerConfig = {
  api: 'https://min-api.cryptocompare.com/data/price',
  pollInterval: 600_000,
};
