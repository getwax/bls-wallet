import { EventEmitter } from 'events';

import { BlsWalletWrapper } from 'bls-wallet-clients';
import type { Aggregator } from 'bls-wallet-clients';
import type { ethers } from 'ethers';
import type TypedEventEmitter from 'typed-emitter';
import { browser } from 'webextension-polyfill-ts';

import { PRIVATE_KEY_STORAGE_KEY } from './env';
import generateRandomHex from './helpers/generateRandomHex';
import TaskQueue from './common/TaskQueue';
import { PageEvents } from './components/Page';
import * as env from './env';

export type AppState = {
  privateKey?: string;
  walletAddress: {
    value?: string;
    loadCounter: number;
  };
  walletState: {
    nonce?: string;
    balance?: string;
  };
};

type Events = {
  state(state: AppState): void;
};

export default class App {
  events = new EventEmitter() as TypedEventEmitter<Events>;
  pageEvents = new EventEmitter() as PageEvents;
  cleanupTasks = new TaskQueue();
  wallet?: BlsWalletWrapper;

  state: AppState;

  constructor(
    public aggregator: Aggregator,
    public provider: ethers.providers.Provider,
    public storage: typeof browser.storage.local,
  ) {
    this.state = {
      walletAddress: {
        loadCounter: 0,
      },
      walletState: {},
    };

    this.setupStorage();
    this.setupBlockListener();
  }

  setupStorage(): void {
    type Listener = Parameters<typeof browser.storage.onChanged.addListener>[0];

    const listener: Listener = (changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }

      const pkChange = changes[PRIVATE_KEY_STORAGE_KEY];

      if (pkChange === undefined) {
        return;
      }

      this.setState({ privateKey: pkChange.newValue });
    };

    browser.storage.onChanged.addListener(listener);

    this.cleanupTasks.push(() => {
      browser.storage.onChanged.removeListener(listener);
    });

    browser.storage.local.get(PRIVATE_KEY_STORAGE_KEY).then((results) => {
      if (PRIVATE_KEY_STORAGE_KEY in results) {
        this.setState({ privateKey: results[PRIVATE_KEY_STORAGE_KEY] });
      }
    });
  }

  setupBlockListener(): void {
    const listener = () => this.checkWalletState();

    this.provider.on('block', listener);

    this.cleanupTasks.push(() => {
      this.provider.off('block', listener);
    });
  }

  async checkWalletState(): Promise<void> {
    if (
      this.wallet &&
      this.state.privateKey &&
      this.wallet.privateKey === this.state.privateKey
    ) {
      const newWalletState = {
        nonce: (await this.wallet.Nonce()).toString(),
        balance: (
          await this.provider.getBalance(this.wallet.address)
        ).toString(),
      };

      if (
        JSON.stringify(newWalletState) !==
        JSON.stringify(this.state.walletState)
      ) {
        this.setState({
          walletState: newWalletState,
        });
      }
    }
  }

  cleanup(): void {
    this.cleanupTasks.run();
  }

  setState(updates: Partial<AppState>): void {
    const oldPrivateKey = this.state.privateKey;
    const oldWalletAddress = this.state.walletAddress.value;

    this.state = { ...this.state, ...updates };

    // When the private key changes, update storage and check for an associated
    // wallet
    if (this.state.privateKey !== oldPrivateKey) {
      if (this.state.privateKey === undefined) {
        browser.storage.local.remove(PRIVATE_KEY_STORAGE_KEY);
      } else {
        browser.storage.local.set({
          [PRIVATE_KEY_STORAGE_KEY]: this.state.privateKey,
        });
      }

      this.checkWalletAddress();
    }

    // When the wallet address changes, clear the wallet nonce
    if (this.state.walletAddress.value !== oldWalletAddress) {
      this.state = { ...this.state, walletState: {} };
    }

    this.events.emit('state', this.state);
  }

  createPrivateKey(): void {
    this.setState({ privateKey: generateRandomHex(256) });
  }

  loadPrivateKey(privateKey: string): void {
    const expectedBits = 256;
    const expectedBytes = expectedBits / 8;

    const expectedLength =
      2 + // 0x
      2 * expectedBytes; // 2 hex characters per byte

    if (privateKey.length !== expectedLength) {
      this.pageEvents.emit(
        'notification',
        'error',
        'Failed to restore private key: incorrect length',
      );
      return;
    }

    if (!/0x([0-9a-f])*$/i.test(privateKey)) {
      this.pageEvents.emit(
        'notification',
        'error',
        'Failed to restore private key: incorrect format',
      );
      return;
    }

    this.setState({ privateKey });
  }

  deletePrivateKey(): void {
    this.setState({ privateKey: undefined });
  }

  PublicKey(): string | undefined {
    if (this.state.privateKey === undefined) {
      return undefined;
    }

    return this.wallet?.PublicKeyStr();
  }

  async checkWalletAddress(): Promise<void> {
    if (this.state.privateKey === undefined) {
      this.setState({
        walletAddress: {
          ...this.state.walletAddress,
          value: undefined,
        },
      });

      return;
    }

    this.incrementWalletAddressLoading();
    const lookupPrivateKey = this.state.privateKey;

    try {
      this.wallet = await BlsWalletWrapper.connect(
        this.state.privateKey,
        env.NETWORK_CONFIG.addresses.verificationGateway,
        this.provider,
      );

      if (this.state.privateKey !== lookupPrivateKey) {
        return;
      }

      this.setState({
        walletAddress: {
          ...this.state.walletAddress,
          value: this.wallet?.address,
        },
      });

      this.checkWalletState();
    } catch (err) {
      console.error(err);
    } finally {
      this.decrementWalletAddressLoading();
    }
  }

  incrementWalletAddressLoading(): void {
    this.setState({
      walletAddress: {
        ...this.state.walletAddress,
        loadCounter: this.state.walletAddress.loadCounter + 1,
      },
    });
  }

  decrementWalletAddressLoading(): void {
    this.setState({
      walletAddress: {
        ...this.state.walletAddress,
        loadCounter: this.state.walletAddress.loadCounter - 1,
      },
    });
  }
}
