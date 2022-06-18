/* eslint-disable no-empty-pattern */

import * as io from 'io-ts';

import { getUserLanguage } from './utils';
import NetworkController from './Network/NetworkController';
import CurrencyController, {
  CurrencyControllerConfig,
} from './CurrencyController';
import KeyringController from './KeyringController';
import PreferencesController from './PreferencesController';
import CellCollection from '../cells/CellCollection';
import ExplicitAny from '../types/ExplicitAny';
import {
  PrivateRpc,
  PrivateRpcMessage,
  PrivateRpcMethodName,
  ProviderState,
  PublicRpc,
  PublicRpcMessage,
  PublicRpcMethodMessage,
  PublicRpcMethodName,
  rpcMap,
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

export default class QuillController {
  networkController: NetworkController;
  currencyController: CurrencyController;
  keyringController: KeyringController;
  preferencesController: PreferencesController;
  aggregatorController: AggregatorController;

  time = TimeCell(1000);
  cells: QuillCells;

  constructor(
    public storage: CellCollection,
    public currencyControllerConfig: CurrencyControllerConfig,
  ) {
    this.cells = QuillCells(storage);

    this.networkController = new NetworkController(
      this.cells.network,
      this.time,
    );

    this.currencyController = new CurrencyController(
      this.currencyControllerConfig,
      this.cells.preferredCurrency,
      this.networkController.ticker,
    );

    this.keyringController = new KeyringController(this.cells.keyring);

    this.preferencesController = new PreferencesController(
      this.cells.preferences,
    );

    this.aggregatorController = new AggregatorController(
      this.networkController,
      this.keyringController,
    );

    this.watchThings();
  }

  ProviderState(
    _message: PublicRpcMethodMessage<'quill_providerState'>,
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

  privateRpc: PrivateRpc = {
    setSelectedAddress: async (newSelectedAddress) => {
      this.preferencesController.update({
        selectedAddress: newSelectedAddress,
      });

      return 'ok';
    },

    createHDAccount: async () => {
      return this.keyringController.createHDAccount();
    },

    isOnboardingComplete: async () => {
      return this.keyringController.isOnboardingComplete();
    },

    setHDPhrase: async (phrase) => {
      this.keyringController.setHDPhrase(phrase);
      return 'ok';
    },
  };

  publicRpc: PublicRpc = {
    eth_chainId: async () => this.cells.chainId.read(),

    eth_coinbase: async (_message) =>
      (await this.preferencesController.selectedAddress.read()) || null,

    wallet_get_provider_state: async (_message) => {
      const selectedAddress =
        await this.preferencesController.selectedAddress.read();

      return {
        accounts: selectedAddress ? [selectedAddress] : [],
        chainId: (await this.networkController.state.read()).chainId,
        isUnlocked: !!selectedAddress,
      };
    },

    eth_sendTransaction: async (message) => {
      return this.aggregatorController.publicRpc.eth_sendTransaction(message);
    },

    eth_getTransactionByHash: async (message) => {
      const aggregatorRes =
        await this.aggregatorController.publicRpc.eth_getTransactionByHash(
          message,
        );

      if (aggregatorRes !== undefined) {
        return aggregatorRes;
      }

      const networkRes = await this.networkController.fetch(message);
      assertType(networkRes, message.Output);

      return networkRes;
    },

    eth_getTransactionReceipt: async (message) => {
      const aggregatorRes =
        await this.aggregatorController.publicRpc.eth_getTransactionReceipt(
          message,
        );

      if (aggregatorRes !== undefined) {
        return aggregatorRes;
      }

      const networkRes = await this.networkController.fetch(message);
      assertType(networkRes, message.Output);

      return networkRes;
    },

    eth_setPreferredAggregator: async (message) => {
      return this.aggregatorController.publicRpc.eth_setPreferredAggregator(
        message,
      );
    },

    eth_accounts: async ({ origin }) => {
      if (origin === window.location.origin) {
        return (await this.keyringController.state.read()).wallets.map(
          ({ address }) => address,
        );
      }

      const selectedAddress =
        await this.preferencesController.selectedAddress.read();

      // TODO (merge-ok) Expose no accounts if this origin has not been approved,
      // preventing account-requiring RPC methods from completing successfully
      // only show address if account is unlocked
      // https://github.com/web3well/bls-wallet/issues/224
      return selectedAddress ? [selectedAddress] : [];
    },

    eth_requestAccounts: async (_message) => {
      const selectedAddress =
        await this.preferencesController.selectedAddress.read();
      const accounts = selectedAddress ? [selectedAddress] : [];
      return accounts;
    },

    debugMe: async ({ params: [a, b, c] }) => {
      console.log('debugMe', { a, b, c });
      return 'ok' as const;
    },

    quill_providerState: async (message) => {
      const providerState = this.ProviderState(message);

      const {
        params: [opt],
      } = message;

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
  };

  handleMessage(message: unknown): Promise<RpcResult<unknown>> | undefined {
    // TODO: Logging
    // - Don't just log here, also log the same way in page (only include
    //   messages relevant to that page)
    // - Make this configurable in Developer Settings

    if (PublicRpcMessage.is(message)) {
      return toOkError(async () => {
        if (isType(message.method, PublicRpcMethodName)) {
          assertType(message.method, PublicRpcMethodName);

          assertType(
            message.params,
            rpcMap.public[message.method].params as io.Type<ExplicitAny>,
          );

          return (this.publicRpc[message.method] as ExplicitAny)({
            ...message,
            Output: rpcMap.public[message.method].output,
          }) as unknown;
        }

        return this.networkController.fetch(message);
      }).then(toRpcResult);
    }

    if (PrivateRpcMessage.is(message)) {
      return toOkError(async () => {
        assertType(message.method, PrivateRpcMethodName);

        assertType(
          message.params,
          rpcMap.private[message.method].params as io.Type<ExplicitAny>,
        );

        return (this.privateRpc[message.method] as ExplicitAny)(
          ...message.params,
        );
      }).then(toRpcResult);
    }

    // It's important to return undefined synchronously because messages can
    // have multiple handlers and if you return a promise you are taking
    // ownership of replying to that message. If multiple handlers return
    // promises then the browser will just provide the caller with null.
    return undefined;
  }

  async addAccount(privKey: string): Promise<string> {
    const address = await this.keyringController.importAccount(privKey);
    const locale = getUserLanguage();
    this.preferencesController.createUser({
      address,
      locale,
      selectedCurrency: 'USD',
      theme: 'light',
    });
    return address;
  }

  private watchThings() {
    (async () => {
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
      for await (const userCurrency of this.currencyController.userCurrency) {
        await this.currencyController.updateConversionRate();
        this.preferencesController.setSelectedCurrency(userCurrency);
      }
    })();

    (async () => {
      window.ethereum ??= { breakOnAssertionFailures: false };

      const breakOnAssertionFailures = TransformCell.SubWithDefault(
        this.cells.preferences,
        'breakOnAssertionFailures',
        false,
      );

      for await (const brk of breakOnAssertionFailures) {
        window.ethereum.breakOnAssertionFailures = brk;
      }
    })();
  }
}
