import * as React from 'react';

import App from '../App';
import KeyEntryScreen from './KeyEntryScreen';
import WalletHomeScreen from './WalletHomeScreen';

const DefaultScreen = (props: { app: App }): React.ReactElement => {
  if (props.app.state.privateKey === undefined) {
    return <KeyEntryScreen app={props.app} />;
  }

  return <WalletHomeScreen app={props.app} />;
};

export default DefaultScreen;
