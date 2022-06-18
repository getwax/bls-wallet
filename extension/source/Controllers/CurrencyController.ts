import approximate from '../cells/approximate';
import { FormulaCell } from '../cells/FormulaCell';
import { IReadableCell } from '../cells/ICell';
import assert from '../helpers/assert';
import { requireEnv } from '../helpers/envTools';

export type CurrencyControllerConfig = {
  api: string;
  pollInterval: number;
};

const CRYPTO_COMPARE_API_KEY = requireEnv('CRYPTO_COMPARE_API_KEY');

export const defaultCurrencyControllerConfig: CurrencyControllerConfig = {
  api: 'https://min-api.cryptocompare.com/data/price',
  pollInterval: 600_000,
};

export default class CurrencyController {
  conversionRate: IReadableCell<number | undefined>;

  constructor(
    public config: CurrencyControllerConfig,
    public preferredCurrency: IReadableCell<string | undefined>,
    public networkCurrency: IReadableCell<string>,
    public time: IReadableCell<number>,
  ) {
    this.conversionRate = new FormulaCell(
      {
        preferredCurrency,
        networkCurrency,
        time: approximate(time, config.pollInterval),
      },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ preferredCurrency, networkCurrency, time: _ }) =>
        this.fetchConversionRate(networkCurrency, preferredCurrency),
    );
  }

  async fetchConversionRate(
    networkCurrency: string,
    preferredCurrency: string | undefined,
  ): Promise<number | undefined> {
    if (preferredCurrency === undefined) {
      return undefined;
    }

    const apiUrl = new URL(this.config.api);
    apiUrl.searchParams.append('fsym', networkCurrency.toUpperCase());
    apiUrl.searchParams.append('tsyms', preferredCurrency.toUpperCase());
    apiUrl.searchParams.append('api_key', CRYPTO_COMPARE_API_KEY);

    const response = await fetch(apiUrl.toString()).then((res) => res.json());
    const rate = Number(response[preferredCurrency.toUpperCase()]);
    assert(Number.isFinite(rate));

    return rate;
  }
}
