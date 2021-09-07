import * as React from 'react';

import { BlsWalletSigner } from 'bls-wallet-signer';

type Props = {
  blsWalletSigner: BlsWalletSigner;
};

type State = {
  privateKey?: string;
  walletAddress?: string;
};

export default class StatusView extends React.Component<Props, State> {
  render(): React.ReactNode {
    return (
      <div className="status-view">
        <div className="heading">Quill 🪶</div>
        <div className="body">
          <table className="basic-form">
            <tr>
              <td>BLS Key</td>
              <td>key...</td>
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
}
