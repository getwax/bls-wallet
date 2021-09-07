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
    return <>TODO: Status View</>;
  }
}
