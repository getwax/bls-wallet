import * as React from 'react';

import never from '../helpers/never';
import type App from './App';
import { AppState } from './App';

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
      yesAction: keyof App;
    }
  | {
      type: 'private-key-display';
      text: string;
      show: boolean;
    };

type State = {
  appState: AppState;
  overlays: Overlay[];
};

export default class StatusView extends React.Component<Props, State> {
  privateKeyInputElement?: HTMLTextAreaElement;
  cleanupTasks: (() => void)[] = [];

  constructor(props: Props) {
    super(props);

    this.state = {
      appState: props.app.state,
      overlays: [],
    };

    const appStateListener = (appState: AppState) => {
      this.setState({ appState });
    };

    props.app.events.on('state', appStateListener);

    this.cleanupTasks.push(() =>
      props.app.events.off('state', appStateListener),
    );
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
        const unboundYesAction = this.props.app[overlay.yesAction];

        if (typeof unboundYesAction !== 'function') {
          console.error(`yesAction ${overlay.yesAction} is not a function`);
          setTimeout(() => this.popOverlay(), 1000);
          return <>Error (see console)</>;
        }

        const yesAction = unboundYesAction.bind(this.props.app) as () => void;

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
    const publicKey = this.props.app.PublicKey();

    if (publicKey === undefined) {
      return (
        <>
          <button
            type="button"
            onClick={() => this.props.app.createPrivateKey()}
          >
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
    const address = this.state.appState.walletAddress;

    if (address === undefined) {
      if (this.state.appState.privateKey === undefined) {
        return <>&lt;none&gt;</>;
      }

      if (this.state.appState.walletAddressLoadCount > 0) {
        return <>Loading...</>;
      }

      return (
        <button type="button" onClick={() => this.props.app.createWallet()}>
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

  confirmDeleteKey(): void {
    this.pushOverlay({
      type: 'confirm',
      msg: 'Are you sure you want to delete your private key?',
      yesAction: 'deletePrivateKey',
    });
  }

  displayPrivateKey(): void {
    const privateKey = this.state.appState?.privateKey;

    if (privateKey === undefined) {
      console.warn('privateKey not found during displayPrivateKey()');
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

    try {
      this.props.app.loadPrivateKey(this.privateKeyInputElement.value.trim());

      // TODO: Check we're popping the right overlay?
      this.popOverlay();
    } catch (error) {
      this.setOverlayState({
        type: 'restore',
        errorMsg: (error as Error).message,
      });
    }
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
}
