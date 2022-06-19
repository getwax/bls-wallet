import approximate from '../cells/approximate';
import { FormulaCell } from '../cells/FormulaCell';
import { IReadableCell } from '../cells/ICell';
import { CRYPTO_COMPARE_API_KEY } from '../env';
import assert from '../helpers/assert';

export type CurrencyConversionConfig = {
  api: string;
  pollInterval: number;
};

export default function CurrencyConversionCell(
  config: CurrencyConversionConfig,
  preferredCurrency: IReadableCell<string | undefined>,
  networkCurrency: IReadableCell<string>,
  time: IReadableCell<number>,
) {
  return new FormulaCell(
    {
      preferredCurrency,
      networkCurrency,
      time: approximate(time, config.pollInterval),
    },
    // eslint-disable-next-line @typescript-eslint/no-shadow
    ({ preferredCurrency, networkCurrency, time: _ }) =>
      fetchRate(config.api, networkCurrency, preferredCurrency),
  );
}

async function fetchRate(
  api: string,
  networkCurrency: string,
  preferredCurrency: string | undefined,
): Promise<number | undefined> {
  if (preferredCurrency === undefined) {
    return undefined;
  }

  const apiUrl = new URL(api);
  apiUrl.searchParams.append('fsym', networkCurrency.toUpperCase());
  apiUrl.searchParams.append('tsyms', preferredCurrency.toUpperCase());
  apiUrl.searchParams.append('api_key', CRYPTO_COMPARE_API_KEY);

  const response = await fetch(apiUrl.toString()).then((res) => res.json());
  const rate = Number(response[preferredCurrency.toUpperCase()]);
  assert(Number.isFinite(rate));

  return rate;
}
