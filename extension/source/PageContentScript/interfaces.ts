import type { JRPCRequest, SafeEventEmitter } from '@toruslabs/openlogin-jrpc';

export interface ProviderOptions {
  /**
   * The name of the stream used to connect to the wallet.
   */
  jsonRpcStreamName?: string;

  /**
   * The maximum number of event listeners.
   */
  maxEventListeners?: number;
}

export interface BaseProviderState {
  isConnected: boolean;
  initialized: boolean;
  isPermanentlyDisconnected: boolean;
  hasEmittedConnection: boolean;
}

export interface InPageProviderState extends BaseProviderState {
  accounts: null | string[];
  isUnlocked: boolean;
}

export type Maybe<T> = Partial<T> | T | null | undefined;

export interface UnValidatedJsonRpcRequest extends JRPCRequest<unknown> {
  windowId?: string;
}

export interface RequestArguments {
  /** The RPC method to request. */
  method: string;

  /** The params of the RPC method, if any. */
  params?: unknown[] | Record<string, unknown>;
}

export interface SafeEventEmitterProvider extends SafeEventEmitter {
  sendAsync: <T, U>(req: JRPCRequest<T>) => Promise<U>;
  send: <T, U>(req: JRPCRequest<T>, callback: SendCallBack<U>) => void;
}

export type SendCallBack<U> = (err: any, providerRes: U) => void;

export interface LoggerMiddlewareOptions {
  origin: string;
}

export type InPageWalletProviderState = {
  accounts: string[];
  chainId: string;
  isUnlocked: boolean;
};
