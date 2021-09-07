import { BlsWalletSigner } from 'bls-wallet-signer';
import * as React from 'react';
import blsWalletSignerPromise from './blsWalletSignerPromise';
import StatusView from './StatusView';

import './styles.scss';

// eslint-disable-next-line @typescript-eslint/ban-types
type Props = {};

type State = {
  blsWalletSigner?: BlsWalletSigner;
};

export default class Popup extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {};

    blsWalletSignerPromise.then((blsWalletSigner) => {
      this.setState({ blsWalletSigner });
    });
  }

  render(): React.ReactNode {
    console.log(this.state.blsWalletSigner);
    if (this.state.blsWalletSigner) {
      return (
        <div id="popup">
          <StatusView blsWalletSigner={this.state.blsWalletSigner} />
        </div>
      );
    }

    return <>Loading...</>;
  }
}
