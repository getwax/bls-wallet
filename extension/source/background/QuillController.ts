/* eslint-disable no-empty-pattern */

import * as io from 'io-ts';
import { ethers } from 'ethers';

import { getUserLanguage } from './utils';
import NetworkController from './NetworkController';
import KeyringController from './KeyringController';
import PreferencesController from './PreferencesController';
import CellCollection from '../cells/CellCollection';
import ExplicitAny from '../types/ExplicitAny';
import {
  ProviderState,
  RpcImpl,
  rpcMap,
  RpcMessage,
  RpcMethodMessage,
  RpcMethodName,
  RpcResult,
  toRpcResult,
} from '../types/Rpc';
import assertType from '../cells/assertType';
import TimeCell from '../cells/TimeCell';
import QuillCells from '../QuillCells';
import isType from '../cells/isType';
import toOkError from '../helpers/toOkError';
import TransformCell from '../cells/TransformCell';
import { FormulaCell } from '../cells/FormulaCell';
import { IReadableCell } from '../cells/ICell';
import AggregatorController from './AggregatorController';
import CurrencyConversionCell, {
  CurrencyConversionConfig,
} from './CurrencyConversionCell';

export default class QuillController {
  networkController: NetworkController;
  keyringController: KeyringController;
  preferencesController: PreferencesController;
  aggregatorController: AggregatorController;
  currencyConversion: IReadableCell<number | undefined>;

  /**
   * @deprecated
   * FIXME: `BlsWalletWrapper` should just support a vanilla provider.
   */
  ethersProvider: ethers.providers.Provider;

  rpc: RpcImpl;

  time = TimeCell(1000);
  cells: QuillCells;

  constructor(
    public storage: CellCollection,
    public currencyConversionConfig: CurrencyConversionConfig,
  ) {
    this.cells = QuillCells(storage);

    this.networkController = new NetworkController(
      this.cells.network,
      this.time,
    );

    this.ethersProvider = new ethers.providers.Web3Provider(
      this.networkController,
    );

    this.preferencesController = new PreferencesController(
      this.cells.preferences,
    );

    this.currencyConversion = CurrencyConversionCell(
      this.currencyConversionConfig,
      this.preferencesController.preferredCurrency,
      this.networkController.ticker,
      this.time,
    );

    this.keyringController = new KeyringController(
      this.cells.keyring,
      this.cells.selectedAddress,
      this.ethersProvider,
    );

    this.aggregatorController = new AggregatorController(
      this.networkController,
      this.keyringController,
      this.ethersProvider,
    );

    this.watchThings();

    this.rpc = {
      eth_chainId: async () => this.cells.chainId.read(),
      eth_sendTransaction: this.aggregatorController.rpc.eth_sendTransaction,

      eth_getTransactionByHash: async (message) => {
        const aggregatorRes =
          await this.aggregatorController.rpc.eth_getTransactionByHash(message);

        if (aggregatorRes !== undefined) {
          return aggregatorRes;
        }

        const networkRes = await this.networkController.requestStrict(message);
        assertType(networkRes, message.Output);

        return networkRes;
      },

      eth_getTransactionReceipt: async (message) => {
        const aggregatorRes =
          await this.aggregatorController.rpc.eth_getTransactionReceipt(
            message,
          );

        if (aggregatorRes !== undefined) {
          return aggregatorRes;
        }

        const networkRes = await this.networkController.requestStrict(message);
        assertType(networkRes, message.Output);

        return networkRes;
      },

      eth_setPreferredAggregator:
        this.aggregatorController.rpc.eth_setPreferredAggregator,

      eth_coinbase: this.keyringController.rpc.eth_coinbase,
      eth_accounts: this.keyringController.rpc.eth_accounts,
      eth_requestAccounts: this.keyringController.rpc.eth_requestAccounts,
      createHDAccount: this.keyringController.rpc.createHDAccount,
      setHDPhrase: this.keyringController.rpc.setHDPhrase,
      isOnboardingComplete: this.keyringController.rpc.isOnboardingComplete,
      lookupPrivateKey: this.keyringController.rpc.lookupPrivateKey,

      debugMe: async ({ params: [a, b, c] }) => {
        console.log('debugMe', { a, b, c });
        return 'ok' as const;
      },

      quill_providerState: async (message) => {
        const providerState = this.ProviderState(message);

        const {
          params: [opt],
        } = message;

        // TODO: Move this long polling idea inside cells
        for await (const $providerState of providerState) {
          if (
            opt &&
            !providerState.hasChanged(opt.differentFrom, $providerState)
          ) {
            continue;
          }

          return $providerState;
        }

        throw new Error('Unexpected end of providerState cell');
      },

      setSelectedAddress: this.preferencesController.rpc.setSelectedAddress,
    };
  }

  ProviderState(
    _message: RpcMethodMessage<'quill_providerState'>,
  ): IReadableCell<ProviderState> {
    // TODO: (merge-ok) This should be per-provider (or maybe per-origin)

    return new FormulaCell(
      {
        chainId: this.cells.chainId,
        selectedAddress: this.cells.selectedAddress,
        breakOnAssertionFailures: this.cells.breakOnAssertionFailures,
      },
      (cells) => cells,
    );
  }

  // TODO: message -> request
  handleMessage(message: unknown): Promise<RpcResult<unknown>> | undefined {
    // TODO: Logging
    // - Don't just log here, also log the same way in page (only include
    //   messages relevant to that page)
    // - Make this configurable in Developer Settings

    if (RpcMessage.is(message)) {
      // FIXME: duplication of checking message.method
      if (isType(message.method, RpcMethodName)) {
        let methodOrigin = rpcMap[message.method].origin;

        if (methodOrigin === '<quill>') {
          methodOrigin = window.location.origin;
        }

        if (methodOrigin !== message.origin && methodOrigin !== '*') {
          // Don't respond if it's an origin mismatch
          return;
        }
      }

      return toOkError(async () => {
        if (isType(message.method, RpcMethodName)) {
          assertType(
            message.params,
            rpcMap[message.method].params as io.Type<ExplicitAny>,
          );

          return (this.rpc[message.method] as ExplicitAny)({
            ...message,
            Output: rpcMap[message.method].output,
          }) as unknown;
        }

        return this.networkController.requestStrict(message);
      }).then(toRpcResult);
    }

    // It's important to return undefined synchronously because messages can
    // have multiple handlers and if you return a promise you are taking
    // ownership of replying to that message. If multiple handlers return
    // promises then the browser will just provide the caller with null.
    return undefined;
  }

  async addAccount(privKey: string): Promise<string> {
    const address = await this.keyringController.createAccount(privKey);
    const locale = getUserLanguage();
    this.preferencesController.createUser(address, locale, 'USD', 'light');
    return address;
  }

  private watchThings() {
    (async () => {
      // TODO: Don't store the block number. Just use LongPollingCell to provide
      // to consumers, that way we don't need to actively track the block number
      // if nothing needs it.

      const storedBlockNumber = this.storage.Cell(
        'block-number',
        io.number,
        () => this.networkController.blockNumber.read(),
      );

      for await (const blockNumber of this.networkController.blockNumber) {
        await storedBlockNumber.write(blockNumber);
      }
    })();

    (async () => {
      window.ethereum ??= { breakOnAssertionFailures: false };

      const breakOnAssertionFailures = TransformCell.SubWithDefault(
        this.cells.preferences,
        'breakOnAssertionFailures',
        false,
      );

      // TODO: Use .forEach
      // TODO: don't set on window.ethereum (but use global area)
      for await (const brk of breakOnAssertionFailures) {
        window.ethereum.breakOnAssertionFailures = brk;
      }
    })();
  }
}
