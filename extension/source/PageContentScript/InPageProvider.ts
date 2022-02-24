import type { JRPCRequest, JRPCSuccess } from '@toruslabs/openlogin-jrpc';
import { EthereumRpcError } from 'eth-rpc-errors';
import dequal from 'fast-deep-equal';
import type { Duplex } from 'readable-stream';
import {
  PROVIDER,
  PROVIDER_JRPC_METHODS,
  PROVIDER_NOTIFICATIONS,
} from '../common/constants';

import BaseProvider from './BaseProvider';
import {
  InPageProviderState,
  InPageWalletProviderState,
  ProviderOptions,
  RequestArguments,
  UnValidatedJsonRpcRequest,
} from './interfaces';
import messages from './messages';

class QuillInPageProvider extends BaseProvider<InPageProviderState> {
  /**
   * The chain ID of the currently connected Ethereum chain.
   * See [chainId.network]{@link https://chainid.network} for more information.
   */
  public chainId: string | null;

  /**
   * The user's currently selected Ethereum address.
   * If null, Quill Extension is either locked or the user has not permitted any
   * addresses to be viewed.
   */
  public selectedAddress: string | null;

  protected static _defaultState: InPageProviderState = {
    accounts: null,
    isConnected: false,
    isUnlocked: false,
    initialized: false,
    isPermanentlyDisconnected: false,
    hasEmittedConnection: false,
  };

  constructor(
    connectionStream: Duplex,
    { maxEventListeners = 100, jsonRpcStreamName = PROVIDER }: ProviderOptions,
  ) {
    super(connectionStream, { maxEventListeners, jsonRpcStreamName });

    // private state
    this._state = {
      ...QuillInPageProvider._defaultState,
    };

    // public state
    this.selectedAddress = null;
    this.chainId = null;

    this._handleAccountsChanged = this._handleAccountsChanged.bind(this);
    this._handleChainChanged = this._handleChainChanged.bind(this);
    this._handleUnlockStateChanged = this._handleUnlockStateChanged.bind(this);

    // setup own event listeners

    // EIP-1193 connect
    this.on('connect', () => {
      this._state.isConnected = true;
    });

    const jsonRpcNotificationHandler = (payload: RequestArguments) => {
      const { method, params } = payload;
      if (method === PROVIDER_NOTIFICATIONS.ACCOUNTS_CHANGED) {
        this._handleAccountsChanged(params as unknown[]);
      } else if (method === PROVIDER_NOTIFICATIONS.UNLOCK_STATE_CHANGED) {
        this._handleUnlockStateChanged(params as Record<string, unknown>);
      } else if (method === PROVIDER_NOTIFICATIONS.CHAIN_CHANGED) {
        this._handleChainChanged(params as Record<string, unknown>);
      }
    };

    // json rpc notification listener
    this.jsonRpcConnectionEvents.on('notification', jsonRpcNotificationHandler);
  }

  /**
   * Returns whether the inpage provider is connected to Quill Extension.
   */
  isConnected(): boolean {
    return this._state.isConnected;
  }

  // Private Methods
  //= ===================
  /**
   * Constructor helper.
   * Populates initial state by calling 'wallet_getProviderState' and emits
   * necessary events.
   */
  async _initializeState(): Promise<void> {
    try {
      const { accounts, chainId, isUnlocked } = (await this.request({
        method: PROVIDER_JRPC_METHODS.GET_PROVIDER_STATE,
        params: [],
      })) as InPageWalletProviderState;

      // indicate that we've connected, for EIP-1193 compliance
      this.emit('connect', { chainId });

      this._handleChainChanged({ chainId });
      this._handleUnlockStateChanged({ accounts, isUnlocked });
      this._handleAccountsChanged(accounts);
    } catch (error) {
      console.error(
        'Quill Extension: Failed to get initial state. Please report this bug.',
        error,
      );
    } finally {
      console.log('initialized provider state');
      this._state.initialized = true;
      this.emit('_initialized');
    }
  }

  /**
   * Internal RPC method. Forwards requests to background via the RPC engine.
   * Also remap ids inbound and outbound
   */
  _rpcRequest(
    payload: UnValidatedJsonRpcRequest | UnValidatedJsonRpcRequest[],
    callback: (...args: any[]) => void,
    isInternal = false,
  ): void {
    let cb = callback;
    const tempPayload = payload;
    if (!Array.isArray(tempPayload)) {
      if (!tempPayload.jsonrpc) {
        tempPayload.jsonrpc = '2.0';
      }

      if (
        tempPayload.method === 'eth_accounts' ||
        tempPayload.method === 'eth_requestAccounts'
      ) {
        // handle accounts changing
        cb = (err: Error, res: JRPCSuccess<string[]>) => {
          this._handleAccountsChanged(
            res.result || [],
            tempPayload.method === 'eth_accounts',
            isInternal,
          );
          callback(err, res);
        };
      } else if (tempPayload.method === 'wallet_getProviderState') {
        this._rpcEngine.handle(payload as JRPCRequest<unknown>, cb);
        return;
      }
    }
    this._rpcEngine.handle(payload as JRPCRequest<unknown>, cb);
  }

  /**
   * When the provider becomes connected, updates internal state and emits
   * required events. Idempotent.
   *
   * @param chainId - The ID of the newly connected chain.
   * @emits QuillInpageProvider#connect
   */
  protected _handleConnect(chainId: string): void {
    if (!this._state.isConnected) {
      this._state.isConnected = true;
      this.emit('connect', { chainId });
      console.debug(messages.info.connected(chainId));
    }
  }

  /**
   * When the provider becomes disconnected, updates internal state and emits
   * required events. Idempotent with respect to the isRecoverable parameter.
   *
   * Error codes per the CloseEvent status codes as required by EIP-1193:
   * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
   *
   * @param isRecoverable - Whether the disconnection is recoverable.
   * @param errorMessage - A custom error message.
   * @emits QuillInpageProvider#disconnect
   */
  protected _handleDisconnect(
    isRecoverable: boolean,
    errorMessage?: string,
  ): void {
    if (
      this._state.isConnected ||
      (!this._state.isPermanentlyDisconnected && !isRecoverable)
    ) {
      this._state.isConnected = false;

      let error: Error;
      if (isRecoverable) {
        error = new EthereumRpcError(
          1013, // Try again later
          errorMessage || messages.errors.disconnected(),
        );
        console.debug(error);
      } else {
        error = new EthereumRpcError(
          1011, // Internal error
          errorMessage || messages.errors.permanentlyDisconnected(),
        );
        console.error(error);
        this.chainId = null;
        this._state.accounts = null;
        this.selectedAddress = null;
        this._state.isUnlocked = false;
        this._state.isPermanentlyDisconnected = true;
      }

      this.emit('disconnect', error);
    }
  }

  /**
   * Called when accounts may have changed.
   */
  protected _handleAccountsChanged(
    accounts: unknown[],
    isEthAccounts = false,
    isInternal = false,
  ): void {
    // defensive programming
    let finalAccounts = accounts;
    if (!Array.isArray(finalAccounts)) {
      console.error(
        'Quill Extension: Received non-array accounts parameter. Please report this bug.',
        finalAccounts,
      );
      finalAccounts = [];
    }

    for (const account of accounts) {
      if (typeof account !== 'string') {
        console.error(
          'Quill Extension: Received non-string account. Please report this bug.',
          accounts,
        );
        finalAccounts = [];
        break;
      }
    }

    // emit accountsChanged if anything about the accounts array has changed
    if (!dequal(this._state.accounts, finalAccounts)) {
      // we should always have the correct accounts even before eth_accounts
      // returns, except in cases where isInternal is true
      if (
        isEthAccounts &&
        Array.isArray(this._state.accounts) &&
        this._state.accounts.length > 0 &&
        !isInternal
      ) {
        console.error(
          'Quill: "eth_accounts" unexpectedly updated accounts. Please report this bug.',
          finalAccounts,
        );
      }

      this._state.accounts = finalAccounts as string[];
      this.emit('accountsChanged', finalAccounts);
    }

    // handle selectedAddress
    if (this.selectedAddress !== finalAccounts[0]) {
      this.selectedAddress = (finalAccounts[0] as string) || null;
    }
  }

  /**
   * Upon receipt of a new chainId and networkVersion, emits corresponding
   * events and sets relevant public state.
   * Does nothing if neither the chainId nor the networkVersion are different
   * from existing values.
   *
   * @emits QuillInpageProvider#chainChanged
   * @param networkInfo - An object with network info.
   * @param networkInfo.chainId - The latest chain ID.
   * @param networkInfo.networkVersion - The latest network ID.
   */
  protected _handleChainChanged({ chainId }: { chainId?: string } = {}): void {
    if (!chainId) {
      console.error(
        'Quill Extension: Received invalid network parameters. Please report this bug.',
        { chainId },
      );
      return;
    }

    if (chainId === 'loading') {
      this._handleDisconnect(true);
    } else {
      this._handleConnect(chainId);

      if (chainId !== this.chainId) {
        this.chainId = chainId;
        if (this._state.initialized) {
          this.emit('chainChanged', this.chainId);
        }
      }
    }
  }

  /**
   * Upon receipt of a new isUnlocked state, sets relevant public state.
   * Calls the accounts changed handler with the received accounts, or an empty
   * array.
   *
   * Does nothing if the received value is equal to the existing value.
   * There are no lock/unlock events.
   *
   * @param opts - Options bag.
   * @param opts.accounts - The exposed accounts, if any.
   * @param opts.isUnlocked - The latest isUnlocked value.
   */
  protected _handleUnlockStateChanged({
    accounts,
    isUnlocked,
  }: { accounts?: string[]; isUnlocked?: boolean } = {}): void {
    if (typeof isUnlocked !== 'boolean') {
      console.error(
        'Quill Extension: Received invalid isUnlocked parameter. Please report this bug.',
        { isUnlocked },
      );
      return;
    }

    if (isUnlocked !== this._state.isUnlocked) {
      this._state.isUnlocked = isUnlocked;
      this._handleAccountsChanged(accounts || []);
    }
  }
}

export default QuillInPageProvider;
