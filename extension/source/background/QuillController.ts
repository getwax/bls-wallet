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
  RpcRequest,
  RpcMethodName,
} from '../types/Rpc';
import assertType from '../cells/assertType';
import QuillStorageCells from '../QuillStorageCells';
import isType from '../cells/isType';
import { FormulaCell } from '../cells/FormulaCell';
import { IReadableCell } from '../cells/ICell';
import AggregatorController from './AggregatorController';
import CurrencyConversionCell from './CurrencyConversionCell';
import assert from '../helpers/assert';
import RandomId from '../helpers/RandomId';
import mapValues from '../helpers/mapValues';
import LongPollingController from './LongPollingController';
import isPermittedOrigin from './isPermittedOrigin';
import TransactionsController from './TransactionsController';
import { MultiNetworkConfig } from '../MultiNetworkConfig';
import Config from '../Config';

export type StorageConfig = {
  standardStorage: CellCollection;
  encryptedStorage: CellCollection;
};

export default class QuillController {
  networkController: NetworkController;
  keyringController: KeyringController;
  transactionsController: TransactionsController;
  preferencesController: PreferencesController;
  aggregatorController: AggregatorController;
  longPollingController: LongPollingController;

  currencyConversion: IReadableCell<{
    from: string;
    to: string | undefined;
    rate: number | undefined;
  }>;

  /**
   * @deprecated
   * FIXME: `BlsWalletWrapper` should just support a vanilla provider.
   */
  ethersProvider: IReadableCell<ethers.providers.Provider>;

  rpc: RpcImpl;
  internalRpc: RpcClient;

  cells: QuillStorageCells;

  constructor(
    public config: Config,
    public multiNetworkConfig: MultiNetworkConfig,
    public storage: StorageConfig,
  ) {
    this.cells = QuillStorageCells(
      config,
      storage.standardStorage,
      storage.encryptedStorage,
    );

    this.networkController = new NetworkController(this.cells.network);

    this.ethersProvider = new FormulaCell(
      { network: this.cells.network },
      () => new ethers.providers.Web3Provider(this.networkController),
    );

    this.keyringController = new KeyringController(
      multiNetworkConfig,
      () => this.internalRpc,
      this.cells.keyring,
      this.cells.selectedPublicKeyHash,
      this.cells.network,
      this.ethersProvider,
    );

    this.preferencesController = new PreferencesController(
      this.cells.preferences,
      this.keyringController,
    );

    this.currencyConversion = CurrencyConversionCell(
      config.currencyConversion,
      this.cells.currency,
      FormulaCell.Sub(this.cells.network, 'chainCurrency'),
    );

    this.transactionsController = new TransactionsController(
      () => this.internalRpc,
      this.cells.transactions,
    );

    this.aggregatorController = new AggregatorController(
      multiNetworkConfig,
      () => this.internalRpc,
      this.networkController,
      this.keyringController,
      this.transactionsController,
      this.ethersProvider,
    );

    this.longPollingController = new LongPollingController({
      blockNumber: this.networkController.blockNumber,
      providerState: this.cells.providerState,
      currencyConversion: this.currencyConversion,
    });

    this.rpc = {
      eth_chainId: async () => this.cells.chainId.read(),
      eth_sendTransaction: this.aggregatorController.rpc.eth_sendTransaction,

      eth_getTransactionByHash: async (request) => {
        const aggregatorRes =
          await this.aggregatorController.rpc.eth_getTransactionByHash(request);

        if (aggregatorRes !== undefined) {
          return aggregatorRes;
        }

        const networkRes = await this.networkController.requestStrict(request);
        assertType(networkRes, request.Response);

        return networkRes;
      },

      eth_getTransactionReceipt: async (request) => {
        const {
          params: [hash],
        } = request;

        if (hash in this.aggregatorController.knownTransactions) {
          return await this.aggregatorController.rpc.eth_getTransactionReceipt(
            request,
          );
        }

        const networkRes = await this.networkController.requestStrict(request);
        assertType(networkRes, request.Response);

        return networkRes;
      },

      eth_setPreferredAggregator:
        this.aggregatorController.rpc.eth_setPreferredAggregator,

      eth_coinbase: this.keyringController.rpc.eth_coinbase,
      eth_accounts: this.keyringController.rpc.eth_accounts,
      eth_requestAccounts: this.keyringController.rpc.eth_requestAccounts,
      addHDAccount: this.keyringController.rpc.addHDAccount,
      setHDPhrase: this.keyringController.rpc.setHDPhrase,
      lookupPrivateKey: this.keyringController.rpc.lookupPrivateKey,
      pkHashToAddress: this.keyringController.rpc.pkHashToAddress,
      addAccount: this.keyringController.rpc.addAccount,
      createTempAccount: this.keyringController.rpc.createTempAccount,
      removeAccount: this.keyringController.rpc.removeAccount,
      addRecoveryWallet: this.keyringController.rpc.addRecoveryWallet,

      // TransactionsController
      createTransaction: this.transactionsController.rpc.createTransaction,
      getTransactionById: this.transactionsController.rpc.getTransactionById,
      getTransactionByHash:
        this.transactionsController.rpc.getTransactionByHash,
      updateTransactionStatus:
        this.transactionsController.rpc.updateTransactionStatus,
      promptUser: this.transactionsController.rpc.promptUser,
      requestTransaction: this.transactionsController.rpc.requestTransaction,
      updateTransactionBundleHash:
        this.transactionsController.rpc.updateTransactionBundleHash,
      updateTransactionHashByBundleHash:
        this.transactionsController.rpc.updateTransactionHashByBundleHash,

      debugMe: async ({ params: [a, b, c] }) => {
        console.log('debugMe', { a, b, c });

        return {
          // This special debugging method uses io.unknown for Response, which
          // is what enables returning anything here. All real methods should
          // use precise typing.
          ahoy: `Looks like you sent ${[a, b, c]}`,
        };
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
            type: 'quill-rpc-request',
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

  handleRequest(request: unknown): Promise<unknown> | undefined {
    if (RpcRequest.is(request)) {
      if (isType(request.method, RpcMethodName)) {
        const rpcMethod = rpcMap[request.method];

        assert(
          isPermittedOrigin(request.origin, rpcMethod.origin),
          () =>
            new Error(
              [
                `Origin ${request.origin}`,
                `is not allowed to access ${request.method}`,
                `because the method is restricted to ${rpcMethod.origin}`,
              ].join(' '),
            ),
        );

        assertType(request.params, rpcMethod.Params as io.Type<ExplicitAny>);

        return (this.rpc[request.method] as ExplicitAny)({
          ...request,

          // TODO: Just put rpcMethod here
          Params: rpcMethod.Params,
          Response: rpcMethod.Response,
        });
      }

      return this.networkController.requestStrict(request);
    }

    // It's important to return undefined synchronously because messages can
    // have multiple handlers and if you return a promise you are taking
    // ownership of replying to that message. If multiple handlers return
    // promises then the browser will just provide the caller with null.
    return undefined;
  }
}
