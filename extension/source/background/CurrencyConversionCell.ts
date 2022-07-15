import { FormulaCell } from '../cells/FormulaCell';
import { IReadableCell } from '../cells/ICell';
import TimeCell from '../cells/TimeCell';
import config from '../config';
import assert from '../helpers/assert';

/**
 * We use these aliases because the api we use does not know about them and
 * ETH is a pretty good proxy. Ideally, we would use a data source which is
 * aware of this detail because if these networks run into trouble it could
 * cause their token value to diverge from ETH in a meaningful way.
 * (Conversely, scarcity of the L2 proxy coin could also cause its market value
 * to increase.)
 */
const currencyAliases: Record<string, string | undefined> = {
  ARETH: 'ETH',
  KOR: 'ETH',
};

export default function CurrencyConversionCell(
  preferredCurrency: IReadableCell<string | undefined>,
  chainCurrency: IReadableCell<string>,
) {
  return new FormulaCell(
    {
      preferredCurrency,
      chainCurrency,
      time: TimeCell(config.currencyConversion.pollInterval),
    },
    ({ $preferredCurrency, $chainCurrency }) =>
      fetchRate(
        config.currencyConversion.api,
        $chainCurrency,
        $preferredCurrency,
      ),
  );
}

async function fetchRate(
  api: string,
  chainCurrency: string,
  preferredCurrency: string | undefined,
): Promise<number | undefined> {
  if (preferredCurrency === undefined) {
    return undefined;
  }

  const mappedChainCurrency = currencyAliases[chainCurrency] ?? chainCurrency;

  const apiUrl = new URL(api);
  apiUrl.searchParams.append('fsym', mappedChainCurrency);
  apiUrl.searchParams.append('tsyms', preferredCurrency);
  apiUrl.searchParams.append('api_key', config.currencyConversion.apiKey);

  const response = await fetch(apiUrl.toString()).then((res) => res.json());
  const rate = Number(response[preferredCurrency]);
  assert(Number.isFinite(rate));

  return rate;
}
