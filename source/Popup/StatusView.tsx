import * as React from 'react';

import { BlsWalletSigner } from 'bls-wallet-signer';
import assert from '../helpers/assert';
import Range from '../helpers/Range';

type Props = {
  blsWalletSigner: BlsWalletSigner;
};

type State = {
  wallet?: {
    privateKey: string;
    address?: string;
  };
};

export default class StatusView extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  render(): React.ReactNode {
    return (
      <div className="status-view">
        <div className="heading">Quill 🪶</div>
        <div className="body">
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
        </div>
      </div>
    );
  }

  renderKeyField(): React.ReactNode {
    const publicKey = this.PublicKey();

    if (publicKey === undefined) {
      return (
        <>
          <button type="button" onClick={() => this.createKey()}>
            Create
          </button>
          <button type="button">Restore</button>
        </>
      );
    }

    return (
      <>
        <span>
          {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
        </span>
        <button type="button">Delete</button>
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
