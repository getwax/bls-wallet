import { EventEmitter } from 'events';

import { BlsWalletSigner } from 'bls-wallet-signer';
import type { ethers } from 'ethers';
import type TypedEventEmitter from 'typed-emitter';

import { browser } from 'webextension-polyfill-ts';
import type AggregatorClient from '../AggregatorClient';
import BlsWallet from '../chain/BlsWallet';
import { PRIVATE_KEY_STORAGE_KEY } from '../env';
import assert from '../helpers/assert';
import Range from '../helpers/Range';

export type AppState = {
  privateKey?: string;
  walletAddress?: string;
  walletAddressLoadCount: number;
};

type Events = {
  state: (state: AppState) => void;
};

export default class App {
  events = new EventEmitter() as TypedEventEmitter<Events>;
  cleanupTasks: (() => void)[] = [];

  state: AppState;

  constructor(
    public blsWalletSigner: BlsWalletSigner,
    public aggregatorClient: AggregatorClient,
    public provider: ethers.providers.Provider,
    public storage: typeof browser.storage.local,
  ) {
    this.state = {
      walletAddressLoadCount: 0,
    };

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

  cleanup(): void {
    while (true) {
      const task = this.cleanupTasks.shift();

      if (task === undefined) {
        break;
      }

      try {
        task();
      } catch (error) {
        console.error(error);
      }
    }
  }

  setState(updates: Partial<AppState>): void {
    const oldPrivateKey = this.state.privateKey;
    this.state = { ...this.state, ...updates };

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
      throw new Error('Incorrect length');
    }

    if (!/0x([0-9a-f])*/i.test(privateKey)) {
      throw new Error('Incorrect format');
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

    return this.blsWalletSigner.getPublicKey(this.state.privateKey);
  }

  async createWallet(): Promise<void> {
    const publicKey = this.PublicKey();

    if (this.state.privateKey === undefined || publicKey === undefined) {
      console.error("Can't create a wallet without a key");
      return;
    }

    this.incrementWalletAddressLoading();

    try {
      const creationTx = await BlsWallet.signCreation(
        this.state.privateKey,
        this.provider,
      );

      const createResult = await this.aggregatorClient.createWallet(creationTx);

      if (createResult.address !== undefined) {
        // The address is in the createResult but we'd rather just check with the
        // network to potential mishaps from incorrect aggregators.
        this.checkWalletAddress();
      } else {
        console.error('Create wallet failed', createResult);
      }
    } finally {
      this.decrementWalletAddressLoading();
    }
  }

  async checkWalletAddress(): Promise<void> {
    if (this.state.privateKey === undefined) {
      this.setState({ walletAddress: undefined });
      return;
    }

    this.incrementWalletAddressLoading();
    const lookupPrivateKey = this.state.privateKey;

    try {
      const walletAddress = await BlsWallet.Address(
        this.state.privateKey,
        this.provider,
      );

      if (this.state.privateKey !== lookupPrivateKey) {
        return;
      }

      this.setState({
        walletAddress,
      });
    } finally {
      this.decrementWalletAddressLoading();
    }
  }

  incrementWalletAddressLoading(): void {
    this.setState({
      walletAddressLoadCount: this.state.walletAddressLoadCount + 1,
    });
  }

  decrementWalletAddressLoading(): void {
    this.setState({
      walletAddressLoadCount: this.state.walletAddressLoadCount - 1,
    });
  }
}

function generateRandomHex(bits: number) {
  const bytes = bits / 8;
  assert(bytes === Math.round(bytes));

  const hexBytes = Range(bytes).map(() =>
    Math.floor(256 * Math.random())
      .toString(16)
      .padStart(2, '0'),
  );

  return `0x${hexBytes.join('')}`;
}
