import { IReadableCell } from '../cells/ICell';
import QuillCells, { QuillState } from '../QuillCells';

export interface CurrencyControllerConfig {
  pollInterval: number;
  api?: string;
}

export const defaultCurrencyControllerConfig: CurrencyControllerConfig = {
  api: 'https://min-api.cryptocompare.com/data/price',
  pollInterval: 600_000,
};

export default class CurrencyController {
  private conversionInterval?: number;

  constructor(
    public config: CurrencyControllerConfig,
    public state: QuillCells['preferredCurrency'],
    public nativeCurrency: IReadableCell<string>,
  ) {
    this.updateConversionRate();
    this.scheduleConversionInterval();
  }

  public async update(stateUpdates: Partial<QuillState<'preferredCurrency'>>) {
    await this.state.write({
      ...(await this.state.read()),
      ...stateUpdates,
    });
  }

  async updateConversionRate(): Promise<void> {
    let state: QuillState<'preferredCurrency'> | undefined;
    let nativeCurrency: string | undefined;

    try {
      nativeCurrency = await this.nativeCurrency.read();
      state = await this.state.read();
      const apiUrl = `${
        this.config.api
      }?fsym=${nativeCurrency.toUpperCase()}&tsyms=${state.userCurrency.toUpperCase()}&api_key=${
        process.env.CRYPTO_COMPARE_API_KEY
      }`;
      let response: Response;
      try {
        response = await fetch(apiUrl);
      } catch (error) {
        console.error(
          error,
          'CurrencyController - Failed to request currency from cryptocompare',
        );
        return;
      }
      // parse response
      let parsedResponse: { [key: string]: number };
      try {
        parsedResponse = await response.json();
      } catch {
        console.error(
          new Error(
            `CurrencyController - Failed to parse response "${response.status}"`,
          ),
        );
        return;
      }
      // set conversion rate
      // if (nativeCurrency === 'ETH') {
      // ETH
      //   this.setConversionRate(Number(parsedResponse.bid))
      //   this.setConversionDate(Number(parsedResponse.timestamp))
      // } else
      if (parsedResponse[state.userCurrency.toUpperCase()]) {
        // ETC
        this.update({
          conversionRate: Number(
            parsedResponse[state.userCurrency.toUpperCase()],
          ),
          conversionDate: (Date.now() / 1000).toString(),
        });
      } else {
        this.update({
          conversionRate: 0,
          conversionDate: 'N/A',
        });
      }
    } catch (error) {
      // reset current conversion rate
      console.warn(
        'Quill - Failed to query currency conversion:',
        nativeCurrency,
        state?.userCurrency,
        error,
      );

      this.update({
        conversionRate: 0,
        conversionDate: 'N/A',
      });

      // throw error
      console.error(
        error,
        `CurrencyController - Failed to query rate for currency "${state?.userCurrency}"`,
      );
    }
  }

  public scheduleConversionInterval(): void {
    if (this.conversionInterval) {
      window.clearInterval(this.conversionInterval);
    }
    this.conversionInterval = window.setInterval(() => {
      this.updateConversionRate();
    }, this.config.pollInterval);
  }
}
