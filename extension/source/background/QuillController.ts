/* eslint-disable no-empty-pattern */

import * as io from 'io-ts';
import { ethers } from 'ethers';

import Browser from 'webextension-polyfill';
import NetworkController from './NetworkController';
import KeyringController from './KeyringController';
import PreferencesController from './PreferencesController';
import CellCollection from '../cells/CellCollection';
import ExplicitAny from '../types/ExplicitAny';
import {
  RpcClient,
  RpcImpl,
  rpcMap,
  RpcMessage,
  RpcMethodName,
} from '../types/Rpc';
import assertType from '../cells/assertType';
import QuillStorageCells from '../QuillStorageCells';
import isType from '../cells/isType';
import { FormulaCell } from '../cells/FormulaCell';
import { IReadableCell } from '../cells/ICell';
import AggregatorController from './AggregatorController';
import CurrencyConversionCell, {
  CurrencyConversionConfig,
} from './CurrencyConversionCell';
import forEach from '../cells/forEach';
import assert, { assertConfig } from '../helpers/assert';
import RandomId from '../helpers/RandomId';
import mapValues from '../helpers/mapValues';
import LongPollingController from './LongPollingController';
import isPermittedOrigin from './isPermittedOrigin';

export default class QuillController {
  networkController: NetworkController;
  keyringController: KeyringController;
  preferencesController: PreferencesController;
  aggregatorController: AggregatorController;
  longPollingController: LongPollingController;
  currencyConversion: IReadableCell<number | undefined>;

  /**
   * @deprecated
   * FIXME: `BlsWalletWrapper` should just support a vanilla provider.
   */
  ethersProvider: ethers.providers.Provider;

  rpc: RpcImpl;
  internalRpc: RpcClient;

  cells: QuillStorageCells;

  constructor(
    public storage: CellCollection,
    public currencyConversionConfig: CurrencyConversionConfig,
  ) {
    this.cells = QuillStorageCells(storage);

    // FIXME: MEGAFIX: This should go somewhere else
    window.debug ??= {};
    window.debug.storageCells = this.cells;
    window.debug.Browser = Browser;

    let warned = false;

    window.debug.reset = async () => {
      if (!warned) {
        // TODO: Instead of being dramatic, we probably don't need to care about
        // the completeness of our reset and instead offer backups. This could
        // be a user-facing feature too.
        console.warn(
          [
            "WARNING: This will delete ALL of Quill's storage, including any",
            'private keys. Use debug.reset() again to proceed.',
          ].join(' '),
        );

        warned = true;

        return;
      }

      await Browser.storage.local.clear();
      window.location.reload();
    };

    this.networkController = new NetworkController(this.cells.network);

    this.ethersProvider = new ethers.providers.Web3Provider(
      this.networkController,
    );

    this.preferencesController = new PreferencesController(
      this.cells.preferences,
    );

    this.currencyConversion = CurrencyConversionCell(
      this.currencyConversionConfig,
      this.preferencesController.preferredCurrency,
      FormulaCell.Sub(this.cells.network, 'chainCurrency'),
    );

    this.keyringController = new KeyringController(
      () => this.internalRpc,
      this.cells.keyring,
      this.cells.selectedAddress,
      this.ethersProvider,
    );

    this.aggregatorController = new AggregatorController(
      () => this.internalRpc,
      this.networkController,
      this.keyringController,
      this.ethersProvider,
    );

    this.longPollingController = new LongPollingController({
      blockNumber: this.networkController.blockNumber,
      providerState: this.cells.providerState,
      currencyConversion: this.currencyConversion,
    });

    forEach(
      FormulaCell.Sub(this.cells.developerSettings, 'breakOnAssertionFailures'),
      ($breakOnAssertionFailures) => {
        assertConfig.breakOnFailures = $breakOnAssertionFailures;
      },
    );

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
        assertType(networkRes, message.Response);

        return networkRes;
      },

      eth_getTransactionReceipt: async (message) => {
        const {
          params: [hash],
        } = message;

        if (hash in this.aggregatorController.knownTransactions) {
          return await this.aggregatorController.rpc.eth_getTransactionReceipt(
            message,
          );
        }

        const networkRes = await this.networkController.requestStrict(message);
        assertType(networkRes, message.Response);

        return networkRes;
      },

      addAccount: async (message) => {
        // FIXME: MEGAFIX: Needing to coordinate this between keyringController and
        // preferencesController is a symptom of these controllers having
        // awkwardly overlapping responsibilities. This should be fixed by
        // combining them into AccountController.

        const address = await this.keyringController.rpc.addAccount(message);

        this.preferencesController.createUser(address, 'USD', 'light');
        return address;
      },

      eth_setPreferredAggregator:
        this.aggregatorController.rpc.eth_setPreferredAggregator,

      eth_coinbase: this.keyringController.rpc.eth_coinbase,
      eth_accounts: this.keyringController.rpc.eth_accounts,
      eth_requestAccounts: this.keyringController.rpc.eth_requestAccounts,
      addHDAccount: this.keyringController.rpc.addHDAccount,
      setHDPhrase: this.keyringController.rpc.setHDPhrase,
      lookupPrivateKey: this.keyringController.rpc.lookupPrivateKey,
      removeAccount: this.keyringController.rpc.removeAccount,

      debugMe: async ({ params: [a, b, c] }) => {
        console.log('debugMe', { a, b, c });
        return 'ok' as const;
      },

      setSelectedAddress: this.preferencesController.rpc.setSelectedAddress,
      longPoll: this.longPollingController.rpc.longPoll,
      longPollCancel: this.longPollingController.rpc.longPollCancel,
    };

    this.internalRpc = mapValues(
      this.rpc,
      (method, methodName) =>
        (...params: unknown[]) =>
          (method as ExplicitAny)({
            type: 'quill-rpc',
            id: RandomId(),
            providerId: '(internal-call)',
            origin: window.location.origin,
            method: methodName,
            params,
            Params: rpcMap[methodName].Params,
            Response: rpcMap[methodName].Response,
          }),
    );
  }

  // TODO: MEGAFIX: message -> request
  handleMessage(message: unknown): Promise<unknown> | undefined {
    // TODO: MEGAFIX: Logging
    // - Don't just log here, also log the same way in page (only include
    //   messages relevant to that page)
    // - Make this configurable in Developer Settings

    if (RpcMessage.is(message)) {
      if (isType(message.method, RpcMethodName)) {
        const rpcMethod = rpcMap[message.method];

        assert(
          isPermittedOrigin(message.origin, rpcMethod.origin),
          new Error(
            [
              `Origin ${message.origin}`,
              `is not allowed to access ${message.method}`,
              `because the method is restricted to ${rpcMethod.origin}`,
            ].join(' '),
          ),
        );

        assertType(message.params, rpcMethod.Params as io.Type<ExplicitAny>);

        return (this.rpc[message.method] as ExplicitAny)({
          ...message,

          // FIXME: MEGAFIX: Just put rpcMethod here
          Params: rpcMethod.Params,
          Response: rpcMethod.Response,
        });
      }

      return this.networkController.requestStrict(message);
    }

    // It's important to return undefined synchronously because messages can
    // have multiple handlers and if you return a promise you are taking
    // ownership of replying to that message. If multiple handlers return
    // promises then the browser will just provide the caller with null.
    return undefined;
  }
}
