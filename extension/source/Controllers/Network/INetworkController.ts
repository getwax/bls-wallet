import * as io from 'io-ts';

import {
  JRPCEngine,
  JRPCMiddleware,
  JRPCRequest,
  JRPCResponse,
  SafeEventEmitter,
} from '@toruslabs/openlogin-jrpc';
import { ProviderConfig } from '../constants';
import { getDefaultProviderConfig } from '../utils';

export const NetworkProperties = io.intersection([
  io.record(io.string, io.unknown),
  io.type({
    // undefined means we have not checked yet. (true or false means property is set)
    EIPS: io.record(io.string, io.union([io.boolean, io.undefined])),
  }),
]);

/**
 * Custom network properties
 * @example isEIP1559Compatible: true etc.
 */
export type NetworkProperties = io.TypeOf<typeof NetworkProperties>;

export const NetworkState = io.type({
  chainId: io.string,
  providerConfig: ProviderConfig,
  properties: NetworkProperties,
});

/**
 *
 */
export type NetworkState = io.TypeOf<typeof NetworkState>;

export const defaultNetworkState: NetworkState = {
  chainId: 'loading',
  properties: {
    EIPS: { 1559: undefined },
  },
  providerConfig: getDefaultProviderConfig(),
};

export const NetworkConfig = io.type({
  providerConfig: ProviderConfig,
});

export type NetworkConfig = io.TypeOf<typeof NetworkConfig>;

export interface INetworkController {
  /**
   * Gets the chainId of the network
   */
  getNetworkIdentifier(): Promise<string>;

  /**
   * Connects to the rpcUrl for the current selected provider
   */
  lookupNetwork(): Promise<void>;
}

export type BlockData = string | string[];

export type Block = Record<string, BlockData>;

export type SendAsyncCallBack = (
  err: Error,
  providerRes: JRPCResponse<Block>,
) => void;

export type SendCallBack<U> = (err: any, providerRes: U | undefined) => void;

export type Payload = Partial<JRPCRequest<string[]>>;
export interface SafeEventEmitterProvider extends SafeEventEmitter {
  request: <T, U>(req: JRPCRequest<T>) => Promise<U>;
  sendAsync: <T, U>(req: JRPCRequest<T>) => Promise<U>;
  send: <T, U>(req: JRPCRequest<T>, callback: SendCallBack<U>) => void;
}

export interface ExtendedJsonRpcRequest<T> extends JRPCRequest<T> {
  skipCache?: boolean;
}

export function providerFromEngine(
  engine: JRPCEngine,
): SafeEventEmitterProvider {
  const provider: SafeEventEmitterProvider =
    new SafeEventEmitter() as SafeEventEmitterProvider;
  // handle both rpc send methods
  provider.sendAsync = async <T, U>(req: JRPCRequest<T>) => {
    const res = await engine.handle(req);
    if (res.error) {
      throw new Error(res.error);
    }
    return res.result as U;
  };

  provider.request = async <T, U>(req: JRPCRequest<T>) => {
    const res = await engine.handle(req);
    if (res.error) {
      throw new Error(res.error);
    }
    return res.result as U;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider.send = <T, U>(
    req: JRPCRequest<T>,
    callback: (error: any, providerRes: U | undefined) => void,
  ) => {
    if (typeof callback !== 'function') {
      throw new Error('Must provide callback to "send" method.');
    }
    engine.handle(req, (err, res) => {
      if (err) {
        callback(err, undefined);
      } else if (res.error) {
        callback(new Error(res.error), undefined);
      } else {
        callback(null, res.result as U);
      }
    });
  };
  // forward notifications
  if (engine.on) {
    engine.on('notification', (message: string) => {
      provider.emit('data', null, message);
    });
  }
  return provider;
}

export function providerFromMiddleware(
  middleware: JRPCMiddleware<string[], unknown>,
): SafeEventEmitterProvider {
  const engine = new JRPCEngine();
  engine.push(middleware);
  const provider: SafeEventEmitterProvider = providerFromEngine(engine);
  return provider;
}

export function providerAsMiddleware(
  provider: SafeEventEmitterProvider,
): JRPCMiddleware<unknown, unknown> {
  return async (req, res, _next, end) => {
    // send request to provider
    try {
      const providerRes: unknown = await provider.sendAsync<unknown, unknown>(
        req,
      );
      res.result = providerRes;
      return end();
    } catch (error: unknown) {
      return end(error as Error);
    }
  };
}
