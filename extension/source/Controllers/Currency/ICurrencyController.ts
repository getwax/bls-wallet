import { BaseConfig, BaseState } from '../interfaces';

export interface CurrencyControllerState extends BaseState {
  currentCurrency: string;
  conversionRate: number;
  conversionDate: string;
  nativeCurrency: string;
  ticker: string;
}

export interface CurrencyControllerConfig extends BaseConfig {
  pollInterval: number;
  api: string;
}
