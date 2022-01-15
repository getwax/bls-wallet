import BaseController from '../BaseController';
import {
  BaseCurrencyControllerConfig,
  BaseCurrencyControllerState,
} from './ICurrencyController';

// every ten minutes
const POLLING_INTERVAL = 600_000;

export class BaseCurrencyController<
  C extends BaseCurrencyControllerConfig,
  S extends BaseCurrencyControllerState,
> extends BaseController<C, S> {
  private conversionInterval: number;

  constructor({
    config = {},
    state,
  }: {
    config: Partial<C>;
    state?: Partial<S>;
  }) {
    super({ config, state });
    this.defaultState = {
      currentCurrency: 'usd',
      conversionRate: 0,
      conversionDate: 'N/A',
      nativeCurrency: 'ETH',
    } as S;

    this.defaultConfig = {
      pollInterval: POLLING_INTERVAL,
    } as C;
    this.initialize();
  }

  //
  // PUBLIC METHODS
  //

  public getNativeCurrency(): string {
    return this.state.nativeCurrency;
  }

  public setNativeCurrency(nativeCurrency: string): void {
    this.update({
      nativeCurrency,
      ticker: nativeCurrency,
    } as S);
  }

  public getCurrentCurrency(): string {
    return this.state.currentCurrency;
  }

  public setCurrentCurrency(currentCurrency: string): void {
    this.update({ currentCurrency } as S);
  }

  /**
   * A getter for the conversionRate property
   *
   * @returns The conversion rate from ETH to the selected currency.
   *
   */
  public getConversionRate(): number {
    return this.state.conversionRate;
  }

  public setConversionRate(conversionRate: number): void {
    this.update({ conversionRate } as S);
  }

  /**
   * A getter for the conversionDate property
   *
   * @returns The date at which the conversion rate was set. Expressed in milliseconds since midnight of
   * January 1, 1970
   *
   */
  public getConversionDate(): string {
    return this.state.conversionDate;
  }

  public setConversionDate(conversionDate: string): void {
    this.update({ conversionDate } as S);
  }

  async updateConversionRate(): Promise<void> {
    let currentCurrency = '';
    let nativeCurrency = '';
    try {
      // fiat
      currentCurrency = this.getCurrentCurrency();

      // crypto
      nativeCurrency = this.getNativeCurrency();
      const apiUrl = `${
        this.config.api
      }/currency?fsym=${nativeCurrency.toUpperCase()}&tsyms=${currentCurrency.toUpperCase()}`;
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
      if (parsedResponse[currentCurrency.toUpperCase()]) {
        // ETC
        this.setConversionRate(
          Number(parsedResponse[currentCurrency.toUpperCase()]),
        );
        this.setConversionDate((Date.now() / 1000).toString());
      } else {
        this.setConversionRate(0);
        this.setConversionDate('N/A');
      }
    } catch (error) {
      // reset current conversion rate
      console.warn(
        'Quill - Failed to query currency conversion:',
        nativeCurrency,
        currentCurrency,
        error,
      );
      this.setConversionRate(0);
      this.setConversionDate('N/A');
      // throw error
      console.error(
        error,
        `CurrencyController - Failed to query rate for currency "${currentCurrency}"`,
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
