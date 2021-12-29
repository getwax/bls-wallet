import {
  JRPCEngine,
  JRPCMiddleware,
  JRPCRequest,
  JRPCResponse,
  SafeEventEmitter,
} from '@toruslabs/openlogin-jrpc';
import { ProviderConfig } from '../constants';

import { BaseConfig, BaseState, IController } from '../interfaces';

/**
 * Custom network properties
 * @example isEIP1559Compatible: true etc.
 */
export interface NetworkProperties {
  [key: string]: number | string | boolean | unknown;
}

/**
 *
 */
export interface NetworkState extends BaseState {
  /**
   * Chain Id for the current network
   */
  chainId: string;
  providerConfig: ProviderConfig;
  properties: NetworkProperties;
}

export interface NetworkConfig extends BaseConfig {
  providerConfig: ProviderConfig;
}

export interface INetworkController<C, S> extends IController<C, S> {
  /**
   * Gets the chainId of the network
   */
  getNetworkIdentifier(): string;

  /**
   * Sets provider for the current network controller
   * @param providerConfig - Provider config object
   */
  setProviderConfig(providerConfig: ProviderConfig): void;
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
