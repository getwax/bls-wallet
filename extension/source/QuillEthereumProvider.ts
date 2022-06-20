import * as io from 'io-ts';

import { EventEmitter } from 'events';
import TypedEventEmitter from 'typed-emitter';
import assertType from './cells/assertType';
import forEach from './cells/forEach';

import { FormulaCell } from './cells/FormulaCell';
import isType from './cells/isType';
import LongPollingCell from './cells/LongPollingCell';
import mapValues from './helpers/mapValues';
import RandomId from './helpers/RandomId';
import {
  assertEthereumRequestBody,
  EthereumRequestBody,
  ProviderState,
  RpcClient,
  RpcMap,
  rpcMap,
  RpcMessage,
  RpcMethodName,
  RpcResponse,
} from './types/Rpc';
import ExplicitAny from './types/ExplicitAny';
import { assertConfig } from './helpers/assert';

/**
 * This is Quill's definition of window.ethereum.
 */
export default class QuillEthereumProvider extends (EventEmitter as new () => TypedEventEmitter<{
  accountsChanged(accounts: string[]): void;
  chainChanged(chainId: string): void;
  connect(connection: { chainId: string }): void;
  disconnect(disconnectionMessage: {
    message: string;
    code: number;
    data?: unknown;
  }): void;
}>) {
  isQuill = true;
  breakOnAssertionFailures = false;
  rpc?: RpcClient;

  constructor() {
    super();

    if (window.isQuillExtensionPage) {
      this.#exposeRpc();
    }

    const state = LongPollingCell<ProviderState>(async (opt) =>
      this.request({
        method: 'quill_providerState',
        params: [opt ?? null],
      }),
    );

    const chainId = FormulaCell.Sub(state, 'chainId');
    const selectedAddress = FormulaCell.Sub(state, 'selectedAddress');

    const developerSettings = FormulaCell.Sub(state, 'developerSettings');

    let connected = false;

    forEach(chainId, ($chainId) => {
      if (!connected) {
        connected = true;
        this.emit('connect', { chainId: $chainId });
      }

      this.emit('chainChanged', $chainId);
    });

    // FIXME: MEGAFIX (deferred): The chainId cell is not ending when it should.
    chainId.events.on('end', () =>
      this.emit('disconnect', {
        message: 'disconnected',
        code: 4900,
        data: undefined,
      }),
    );

    forEach(selectedAddress, ($selectedAddress) =>
      this.emit('accountsChanged', $selectedAddress ? [$selectedAddress] : []),
    );

    forEach(
      developerSettings,
      ({ breakOnAssertionFailures, exposeEthereumRpc }) => {
        assertConfig.breakOnFailures = breakOnAssertionFailures;

        const ethereumRpcExposed = this.rpc !== undefined;

        if (exposeEthereumRpc !== ethereumRpcExposed) {
          if (exposeEthereumRpc) {
            this.#exposeRpc();
          } else {
            delete this.rpc;
          }
        }
      },
    );
  }

  async request<M extends string>(
    body: EthereumRequestBody<M>,
  ): Promise<
    M extends RpcMethodName ? io.TypeOf<RpcMap[M]['Output']> : unknown
  > {
    // TODO: MEGAFIX (deferred): Ensure all errors are EthereumRpcError, maybe making use of
    // the ethereum-rpc-error module.

    assertEthereumRequestBody(body);

    const id = RandomId();

    const message: Omit<RpcMessage, 'providerId' | 'origin'> = {
      type: 'quill-rpc',
      id,
      // Note: We do not set providerId or origin here because our code is
      // co-mingled with the dApp and is therefore untrusted. Instead, the
      // content script will add these fields before passing them along to the
      // background script.
      // providerId: this.id,
      // origin: window.location.origin,
      method: body.method,
      params: body.params ?? [],
    };

    window.postMessage(message, '*');

    const response = await new Promise((resolve, reject) => {
      const messageListener = (evt: MessageEvent<unknown>) => {
        if (!isType(evt.data, RpcResponse) || evt.data.id !== id) {
          return;
        }

        window.removeEventListener('message', messageListener);

        if ('ok' in evt.data.result) {
          resolve(evt.data.result.ok);
        } else if ('error' in evt.data.result) {
          const error = new Error(evt.data.result.error.message);
          error.stack = evt.data.result.error.stack;
          reject(error);
        }
      };

      window.addEventListener('message', messageListener);
    });

    if (isType(body.method, RpcMethodName)) {
      // FIXME: MEGAFIX: Naming: output vs response
      assertType(response, rpcMap[body.method].Output as io.Type<unknown>);
    }

    return response as ExplicitAny;
  }

  #exposeRpc() {
    this.rpc = mapValues(rpcMap, (_, method) => {
      return (...params: unknown[]) =>
        this.request({
          method,
          params,
        } as EthereumRequestBody<string>);
    }) as RpcClient;
  }
}
