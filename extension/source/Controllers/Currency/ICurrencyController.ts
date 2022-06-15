import * as io from 'io-ts';

export const CurrencyControllerState = io.type({
  currentCurrency: io.string,
  conversionRate: io.number,
  conversionDate: io.string,
  nativeCurrency: io.string,
});

export type CurrencyControllerState = io.TypeOf<typeof CurrencyControllerState>;

export const defaultCurrencyControllerState: CurrencyControllerState = {
  currentCurrency: 'usd',
  conversionRate: 0,
  conversionDate: 'N/A',
  nativeCurrency: 'ETH',
};

export interface CurrencyControllerConfig {
  pollInterval: number;
  api?: string;
}

export const defaultCurrencyControllerConfig: CurrencyControllerConfig = {
  api: 'https://min-api.cryptocompare.com/data/price',
  pollInterval: 600_000,
};
