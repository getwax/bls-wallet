import * as ethers from 'ethers';
import * as React from 'react';
import { BlsWalletSigner } from 'bls-wallet-signer';

import assert from '../helpers/assert';
import Range from '../helpers/Range';
import never from '../helpers/never';

/* eslint-disable prettier/prettier */

type Props = {
  blsWalletSigner: BlsWalletSigner;
};

type Overlay = (
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
  }
);

type State = {
  wallet?: {
    privateKey: string;
    address?: string;
  };
  overlays: Overlay[];
};

export default class StatusView extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      overlays: [],
    };
  }

  render(): React.ReactNode {
    return (
      <div className="status-view">
        <div className="heading">Quill 🪶</div>
        <div className="body">
          {this.renderBody()}
        </div>
      </div>
    );
  }

  // eslint-disable-next-line consistent-return
  renderBody(): React.ReactNode {
    if (this.state.overlays.length === 0) {
      return (
        <table className="basic-form">
          <tr>
            <td>BLS Key</td>
            <td>{this.renderKeyField()}</td>
          </tr>
          <tr>
            <td>BLS Wallet</td>
            <td>address...</td>
          </tr>
        </table>
      );
    }

    const overlay = this.state.overlays[this.state.overlays.length - 1];

    switch (overlay.type) {
      case 'restore': {
        return <>
          <div>Enter your private key below</div>
          <div>
            <textarea/>
          </div>
          <div>
            <button type="button">Submit</button>
            <button type="button" onClick={() => this.popOverlay()}>Cancel</button>
          </div>
        </>;
      }

      case 'confirm': {
        let yesAction = this[overlay.yesAction];

        if (typeof yesAction !== 'function') {
          console.error(`yesAction ${overlay.yesAction} is not a function`);
          setTimeout(() => this.popOverlay(), 1000);
          return <>Error (see console)</>;
        }

        yesAction = yesAction.bind(this);

        return <>
          <div>{overlay.msg}</div>
          <div>
            <button type="button" onClick={() => { yesAction(); this.popOverlay() }}>Yes</button>
            <button type="button" onClick={() => this.popOverlay()}>No</button>
          </div>
        </>;
      }

      case 'private-key-display': {
        return <>
          <p>
            Store this private key with care. If anyone gains access to this key
            they will have access to your account, including the ability to
            move your assets into another account.
          </p>

          <div>
            {(() => {
              if (!overlay.show) {
                return (
                  <button
                    type="button"
                    onClick={() => this.setOverlayState({ type: 'private-key-display', show: true })}
                  >
                    Click to show
                  </button>
                );
              }

              return <p>{overlay.text}</p>;
            })()}
          </div>

          <div>
            <button type="button" onClick={() => this.popOverlay()}>Back</button>
          </div>
        </>;
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

  createKey(): void {
    this.setState({
      wallet: {
        privateKey: generateRandomHex(256),
      },
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
    this.setState({
      wallet: undefined,
    });
  }

  displayPrivateKey(): void {
    const privateKey = this.state.wallet?.privateKey;

    if (privateKey === undefined) {
      console.warn('privateKey not found during downloadKey()');
      return;
    }

    const privateKeyBytes = ethers.utils.arrayify(privateKey);
    const text = ethers.utils.base58.encode(privateKeyBytes);
    
    this.pushOverlay({
      type: 'private-key-display',
      show: false,
      text,
    });
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
          overlays: [...this.state.overlays.slice(0, i), newOverlay, ...this.state.overlays.slice(i + 1)],
        })

        return;
      }
    }

    console.error("Matching overlay not found in setOverlayState", overlay);
  }

  restoreKey(): void {
    this.pushOverlay({
      type: 'restore',
    });
  }

  PublicKey(): string | undefined {
    const { privateKey } = this.state.wallet ?? {};

    if (privateKey === undefined) {
      return undefined;
    }

    return this.props.blsWalletSigner.getPublicKey(privateKey);
  }
}

function generateRandomHex(bits: number) {
  const bytes = bits / 8;
  assert(bytes === Math.round(bytes));

  const hexBytes = Range(bytes).map(() =>
    Math.floor(256 * Math.random())
      .toString(16)
      .padStart(2, '0')
  );

  return `0x${hexBytes.join('')}`;
}
