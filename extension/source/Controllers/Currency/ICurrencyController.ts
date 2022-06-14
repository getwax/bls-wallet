import * as io from 'io-ts';

import { BaseConfig } from '../interfaces';

export const CurrencyControllerState = io.type({
  currentCurrency: io.string,
  conversionRate: io.number,
  conversionDate: io.string,
  nativeCurrency: io.string,
});

export type CurrencyControllerState = io.TypeOf<typeof CurrencyControllerState>;

export interface CurrencyControllerConfig extends BaseConfig {
  pollInterval: number;
  api?: string;
}

export const defaultCurrencyControllerConfig: CurrencyControllerConfig = {
  api: 'https://min-api.cryptocompare.com/data/price',
  pollInterval: 600_000,
};
