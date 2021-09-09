import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

import assert from '../helpers/assert';
import Range from '../helpers/Range';
import never from '../helpers/never';
import BlsWallet from '../chain/BlsWallet';
import { WALLET_STORAGE_KEY } from '../env';
import type App from './App';

type Props = {
  app: App;
};

type Overlay =
  | {
      type: 'restore';
      errorMsg?: string;
    }
  | {
      type: 'confirm';
      msg: string;
      yesAction: keyof StatusView;
    }
  | {
      type: 'private-key-display';
      text: string;
      show: boolean;
    };

type State = {
  wallet?: {
    privateKey: string;
    address?: string;
  };
  addressLoading?: boolean;
  overlays: Overlay[];
};

export default class StatusView extends React.Component<Props, State> {
  privateKeyInputElement?: HTMLTextAreaElement;
  cleanupTasks: (() => void)[] = [];

  constructor(props: Props) {
    super(props);

    this.state = {
      overlays: [],
    };

    this.listenToStorage();
  }

  listenToStorage(): void {
    type Listener = Parameters<typeof browser.storage.onChanged.addListener>[0];

    const listener: Listener = (changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }

      const walletChange = changes[WALLET_STORAGE_KEY];

      if (walletChange === undefined) {
        return;
      }

      this.setState({
        wallet: walletChange.newValue,
      });
    };

    browser.storage.onChanged.addListener(listener);

    this.cleanupTasks.push(() => {
      browser.storage.onChanged.removeListener(listener);
    });

    browser.storage.local.get(WALLET_STORAGE_KEY).then((results) => {
      if (WALLET_STORAGE_KEY in results) {
        this.setWallet(results[WALLET_STORAGE_KEY]);
      }
    });
  }

  componentWillUnmount(): void {
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

  render(): React.ReactNode {
    return <div className="status-view">{this.renderContent()}</div>;
  }

  // eslint-disable-next-line consistent-return
  renderContent(): React.ReactNode {
    if (this.state.overlays.length === 0) {
      return (
        <table className="basic-form">
          <tr>
            <td>BLS Key</td>
            <td>{this.renderKeyField()}</td>
          </tr>
          <tr>
            <td>BLS Wallet</td>
            <td>{this.renderWalletField()}</td>
          </tr>
        </table>
      );
    }

    const overlay = this.state.overlays[this.state.overlays.length - 1];

    switch (overlay.type) {
      case 'restore': {
        return (
          <>
            <div>Enter your private key below</div>
            <div>
              <textarea
                ref={(ref) => {
                  this.privateKeyInputElement = ref ?? undefined;
                }}
              />
            </div>
            {(() => {
              if (overlay.errorMsg !== undefined) {
                return <div style={{ color: 'red' }}>{overlay.errorMsg}</div>;
              }

              return <></>;
            })()}
            <div>
              <button type="button" onClick={() => this.loadPrivateKey()}>
                Submit
              </button>
              <button type="button" onClick={() => this.popOverlay()}>
                Cancel
              </button>
            </div>
          </>
        );
      }

      case 'confirm': {
        let yesAction = this[overlay.yesAction];

        if (typeof yesAction !== 'function') {
          console.error(`yesAction ${overlay.yesAction} is not a function`);
          setTimeout(() => this.popOverlay(), 1000);
          return <>Error (see console)</>;
        }

        yesAction = yesAction.bind(this);

        return (
          <>
            <div>{overlay.msg}</div>
            <div>
              <button
                type="button"
                onClick={() => {
                  yesAction();
                  this.popOverlay();
                }}
              >
                Yes
              </button>
              <button type="button" onClick={() => this.popOverlay()}>
                No
              </button>
            </div>
          </>
        );
      }

      case 'private-key-display': {
        return (
          <>
            <p>Store this private key with care.</p>
            <p>
              It&apos;s different from your public key displayed on the main
              page, which can be shared to allow others to interact with your
              account, such as send you assets.
            </p>
            <p>
              This is the <i>private</i> key, and if anyone gains access to it
              they will have access to your account, including the ability to
              move your assets into another account.
            </p>

            <p>
              {(() => {
                if (!overlay.show) {
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        this.setOverlayState({
                          type: 'private-key-display',
                          show: true,
                        })
                      }
                    >
                      Click to show
                    </button>
                  );
                }

                return <p>{overlay.text}</p>;
              })()}
            </p>

            <p>
              <button type="button" onClick={() => this.popOverlay()}>
                Back
              </button>
            </p>
          </>
        );
      }

      default: {
        never(overlay);
      }
    }
  }

  renderKeyField(): React.ReactNode {
    const publicKey = this.PublicKey();

    if (publicKey === undefined) {
      return (
        <>
          <button type="button" onClick={() => this.createKey()}>
            Create
          </button>
          <span
            className="pseudo-button"
            onClick={() => this.restoreKey()}
            onKeyDown={(evt) => evt.key === 'Enter' && this.restoreKey()}
          >
            ⬆️
          </span>
        </>
      );
    }

    return (
      <>
        <span>
          {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
        </span>
        <span
          className="pseudo-button"
          onClick={() => this.displayPrivateKey()}
          onKeyDown={(evt) => evt.key === 'Enter' && this.displayPrivateKey()}
        >
          ⬇️
        </span>
        <span
          className="pseudo-button"
          onClick={() => this.confirmDeleteKey()}
          onKeyDown={(evt) => evt.key === 'Enter' && this.confirmDeleteKey()}
        >
          ❌
        </span>
      </>
    );
  }

  renderWalletField(): React.ReactNode {
    const address = this.state.wallet?.address;

    if (address === undefined) {
      if (this.state.wallet?.privateKey === undefined) {
        return <>&lt;none&gt;</>;
      }

      if (this.state.addressLoading) {
        return <>Loading...</>;
      }

      return (
        <button type="button" onClick={() => this.createWallet()}>
          Create
        </button>
      );
    }

    return (
      <span>
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
    );
  }

  setWallet(wallet: State['wallet']): void {
    const previousPrivateKey = this.state.wallet?.privateKey;

    if (wallet === undefined) {
      browser.storage.local.remove(WALLET_STORAGE_KEY);
    } else {
      browser.storage.local.set({ [WALLET_STORAGE_KEY]: wallet });

      if (wallet.privateKey !== previousPrivateKey) {
        this.lookForExistingWallet(wallet);
      }
    }

    this.setState({ wallet });
  }

  createKey(): void {
    this.setWallet({
      privateKey: generateRandomHex(256),
    });
  }

  confirmDeleteKey(): void {
    this.pushOverlay({
      type: 'confirm',
      msg: 'Are you sure you want to delete your private key?',
      yesAction: 'deleteKey',
    });
  }

  deleteKey(): void {
    this.setWallet(undefined);
  }

  displayPrivateKey(): void {
    const privateKey = this.state.wallet?.privateKey;

    if (privateKey === undefined) {
      console.warn('privateKey not found during downloadKey()');
      return;
    }

    this.pushOverlay({
      type: 'private-key-display',
      show: false,
      text: privateKey,
    });
  }

  loadPrivateKey(): void {
    if (this.privateKeyInputElement === undefined) {
      this.setOverlayState({
        type: 'restore',
        errorMsg: 'input element missing',
      });
      return;
    }

    const inputText = this.privateKeyInputElement.value.trim();

    const expectedBits = 256;
    const expectedBytes = expectedBits / 8;

    const expectedLength =
      2 + // 0x
      2 * expectedBytes; // 2 hex characters per byte

    if (inputText.length !== expectedLength) {
      this.setOverlayState({ type: 'restore', errorMsg: 'Incorrect length' });
      return;
    }

    if (!/0x([0-9a-f])*/i.test(inputText)) {
      this.setOverlayState({ type: 'restore', errorMsg: 'Incorrect format' });
      return;
    }

    this.setWallet({
      privateKey: inputText,
    });

    // TODO: Check we're popping the right overlay?
    this.popOverlay();
  }

  pushOverlay(overlay: Overlay): void {
    this.setState({
      overlays: [...this.state.overlays, overlay],
    });
  }

  popOverlay(): void {
    this.setState({
      overlays: this.state.overlays.slice(0, -1),
    });
  }

  setOverlayState(overlay: { type: Overlay['type'] } & Partial<Overlay>): void {
    for (let i = this.state.overlays.length - 1; i >= 0; i -= 1) {
      if (this.state.overlays[i].type === overlay.type) {
        const newOverlay = { ...this.state.overlays[i], ...overlay } as Overlay;

        this.setState({
          overlays: [
            ...this.state.overlays.slice(0, i),
            newOverlay,
            ...this.state.overlays.slice(i + 1),
          ],
        });

        return;
      }
    }

    console.error('Matching overlay not found in setOverlayState', overlay);
  }

  restoreKey(): void {
    this.pushOverlay({
      type: 'restore',
    });
  }

  async createWallet(): Promise<void> {
    const { privateKey } = this.state.wallet ?? {};
    const publicKey = this.PublicKey();

    if (privateKey === undefined || publicKey === undefined) {
      console.error("Can't create a wallet without a key");
      return;
    }

    this.setState({ addressLoading: true });

    const creationTx = await BlsWallet.signCreation(
      privateKey,
      this.props.app.provider,
    );

    const createResult = await this.props.app.aggregatorClient.createWallet(
      creationTx,
    );

    if (createResult.address !== undefined) {
      // The address is in the createResult but we'd rather just check with the
      // network to potential mishaps from incorrect aggregators.
      this.lookForExistingWallet(this.state.wallet);
    } else {
      console.error('Create wallet failed', createResult);
      this.setState({ addressLoading: false });
    }
  }

  lookForExistingWallet(wallet: State['wallet']): void {
    if (wallet === undefined) {
      return;
    }

    this.setState({
      addressLoading: true,
    });

    BlsWallet.Address(wallet.privateKey, this.props.app.provider).then(
      (address) => {
        this.setState({
          addressLoading: false,
        });

        const latestWallet = this.state.wallet;

        if (latestWallet?.privateKey !== wallet.privateKey) {
          return;
        }

        this.setWallet({
          ...latestWallet,
          address,
        });
      },
    );
  }

  PublicKey(): string | undefined {
    const { privateKey } = this.state.wallet ?? {};

    if (privateKey === undefined) {
      return undefined;
    }

    return this.props.app.blsWalletSigner.getPublicKey(privateKey);
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
