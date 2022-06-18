import approximate from '../cells/approximate';
import { FormulaCell } from '../cells/FormulaCell';
import { IReadableCell } from '../cells/ICell';
import assert from '../helpers/assert';
import { requireEnv } from '../helpers/envTools';
import QuillCells from '../QuillCells';

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
  userCurrency: IReadableCell<string>;
  conversionRate: IReadableCell<number>;

  constructor(
    public config: CurrencyControllerConfig,
    public state: QuillCells['preferredCurrency'],
    public networkCurrency: IReadableCell<string>,
    public time: IReadableCell<number>,
  ) {
    this.userCurrency = new FormulaCell(
      { state },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ state }) => state.userCurrency,
    );

    this.conversionRate = new FormulaCell(
      {
        userCurrency: this.userCurrency,
        networkCurrency,
        time: approximate(time, config.pollInterval),
      },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ userCurrency, networkCurrency, time: _ }) =>
        this.fetchConversionRate(networkCurrency, userCurrency),
    );
  }

  async fetchConversionRate(
    networkCurrency: string,
    userCurrency: string,
  ): Promise<number> {
    const apiUrl = new URL(this.config.api);
    apiUrl.searchParams.append('fsym', networkCurrency.toUpperCase());
    apiUrl.searchParams.append('tsyms', userCurrency.toUpperCase());
    apiUrl.searchParams.append('api_key', CRYPTO_COMPARE_API_KEY);

    const response = await fetch(apiUrl.toString()).then((res) => res.json());
    const rate = Number(response[userCurrency.toUpperCase()]);
    assert(Number.isFinite(rate));

    return rate;
  }
}
