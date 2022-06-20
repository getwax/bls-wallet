/* eslint-disable no-empty-pattern */

import * as io from 'io-ts';
import { ethers } from 'ethers';

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
import { assertConfig } from '../helpers/assert';
import RandomId from '../helpers/RandomId';
import mapValues from '../helpers/mapValues';
import LongPollingController from './LongPollingController';

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
    });

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
      isOnboardingComplete: this.keyringController.rpc.isOnboardingComplete,
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
      // FIXME: MEGAFIX: duplication of checking message.method
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

      if (isType(message.method, RpcMethodName)) {
        const { Params, Response } = rpcMap[message.method];

        assertType(message.params, Params as io.Type<ExplicitAny>);

        return (this.rpc[message.method] as ExplicitAny)({
          ...message,
          Params,
          Response,
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

  private watchThings() {
    // TODO: MEGAFIX: Don't store the block number. Just use LongPollingCell to provide
    // to consumers, that way we don't need to actively track the block number
    // if nothing needs it.
    const storedBlockNumber = this.storage.Cell('block-number', io.number, () =>
      this.networkController.blockNumber.read(),
    );

    forEach(this.networkController.blockNumber, async ($blockNumber) => {
      await storedBlockNumber.write($blockNumber);
    });

    forEach(
      FormulaCell.Sub(this.cells.developerSettings, 'breakOnAssertionFailures'),
      ($breakOnAssertionFailures) => {
        assertConfig.breakOnFailures = $breakOnAssertionFailures;
      },
    );
  }
}
