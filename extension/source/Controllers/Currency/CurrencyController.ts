import CellCollection from '../../cells/CellCollection';
import ICell from '../../cells/ICell';
import {
  CurrencyControllerConfig,
  CurrencyControllerState,
  defaultCurrencyControllerConfig,
  defaultCurrencyControllerState,
} from './ICurrencyController';

export default class CurrencyController {
  private conversionInterval?: number;
  public config: CurrencyControllerConfig;
  public state: ICell<CurrencyControllerState>;

  constructor(
    config: CurrencyControllerConfig | undefined,
    storage: CellCollection,
  ) {
    this.config = config ?? defaultCurrencyControllerConfig;

    this.state = storage.Cell(
      'CurrencyController',
      CurrencyControllerState,
      () => defaultCurrencyControllerState,
    );

    this.updateConversionRate();
    this.scheduleConversionInterval();
  }

  //
  // PUBLIC METHODS
  //

  public async update(stateUpdates: Partial<CurrencyControllerState>) {
    await this.state.write({
      ...(await this.state.read()),
      ...stateUpdates,
    });
  }

  async updateConversionRate(): Promise<void> {
    let state: CurrencyControllerState | undefined;

    try {
      state = await this.state.read();
      const apiUrl = `${
        this.config.api
      }?fsym=${state.nativeCurrency.toUpperCase()}&tsyms=${state.currentCurrency.toUpperCase()}&api_key=${
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
      if (parsedResponse[state.currentCurrency.toUpperCase()]) {
        // ETC
        this.update({
          conversionRate: Number(
            parsedResponse[state.currentCurrency.toUpperCase()],
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
        state?.nativeCurrency,
        state?.currentCurrency,
        error,
      );

      this.update({
        conversionRate: 0,
        conversionDate: 'N/A',
      });

      // throw error
      console.error(
        error,
        `CurrencyController - Failed to query rate for currency "${state?.currentCurrency}"`,
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
