import * as io from 'io-ts';

import { EventEmitter } from 'events';
import TypedEventEmitter from 'typed-emitter';
import assertType from './cells/assertType';
import forEach from './cells/forEach';

import { FormulaCell } from './cells/FormulaCell';
import isType from './cells/isType';
import mapValues from './helpers/mapValues';
import RandomId from './helpers/RandomId';
import {
  assertEthereumRequestBody,
  EthereumRequestBody,
  RpcClient,
  RpcMap,
  rpcMap,
  RpcMessage,
  RpcMethodName,
  RpcResponse,
} from './types/Rpc';
import ExplicitAny from './types/ExplicitAny';
import { assertConfig } from './helpers/assert';
import QuillLongPollingCell from './QuillLongPollingCell';

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
  #isQuillExtensionPage: boolean;
  #shouldLog = false;

  constructor(isQuillExtensionPage = false) {
    super();

    this.#isQuillExtensionPage = isQuillExtensionPage;

    if (this.#isQuillExtensionPage) {
      this.#exposeRpc();
    }

    const state = QuillLongPollingCell(this, 'providerState');

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
      ({ breakOnAssertionFailures, exposeEthereumRpc, rpcLogging }) => {
        assertConfig.breakOnFailures = breakOnAssertionFailures;

        const shouldExposeEthereumRpc =
          exposeEthereumRpc || this.#isQuillExtensionPage;

        const ethereumRpcExposed = this.rpc !== undefined;

        if (ethereumRpcExposed !== shouldExposeEthereumRpc) {
          if (shouldExposeEthereumRpc) {
            this.#exposeRpc();
          } else {
            delete this.rpc;
          }
        }

        this.#shouldLog = rpcLogging.inPage;
      },
    );
  }

  request<M extends string>(
    body: EthereumRequestBody<M>,
  ): Promise<
    M extends RpcMethodName ? io.TypeOf<RpcMap[M]['Response']> : unknown
  > {
    assertEthereumRequestBody(body);

    const response = (async () => {
      // TODO: MEGAFIX (deferred): Ensure all errors are EthereumRpcError, maybe making use of
      // the ethereum-rpc-error module.

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

      const backgroundResponse = await new Promise((resolve, reject) => {
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
        assertType(
          backgroundResponse,
          rpcMap[body.method].Response as io.Type<unknown>,
        );
      }

      return backgroundResponse as ExplicitAny;
    })();

    if (this.#shouldLog) {
      if (this.rpc && body.method in this.rpc) {
        console.log(
          // Ok, we might be lying a bit here. We're logging the ethereum.rpc
          // version of the call regardless of which version was actually used.
          // This is to help raise awareness of the proposed ethereum.rpc way of
          // doing things.
          `ethereum.rpc.${body.method}(${body.params
            .map((p) => JSON.stringify(p))
            .join(', ')}) ->`,
          response,
        );
      } else {
        console.log(
          `ethereum.request({\n  method: ${JSON.stringify(
            body.method,
          )},\n  params: [${body.params
            .map((p) => JSON.stringify(p))
            .join(', ')}],\n}) ->`,
          response,
        );
      }
    }

    return response;
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
