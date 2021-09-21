import { ethers } from 'ethers';
import * as React from 'react';
import type App from './App';
import { AppState } from './App';
import KeyEntryScreen from './components/KeyEntryScreen';
import LoadingScreen from './components/LoadingScreen';
import WalletHomeScreen from './components/WalletHomeScreen';

import './styles.scss';

type Props = {
  appPromise: Promise<App>;
};

type State = {
  app?: App;
  appState?: AppState;
};

export default class Popup extends React.Component<Props, State> {
  cleanupTasks: (() => void)[] = [];

  constructor(props: Props) {
    super(props);

    this.state = {};

    this.props.appPromise.then((app) => {
      this.setState({ app });

      app.events.on('state', appStateListener);

      this.cleanupTasks.push(() => app.events.off('state', appStateListener));
    });

    const appStateListener = (appState: AppState) => {
      this.setState({ appState });
    };
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
    return <div className="popup">{this.renderContent()}</div>;
  }

  renderContent(): React.ReactNode {
    if (!this.state.appState) {
      return <LoadingScreen />;
    }

    if (this.state.appState.privateKey === undefined) {
      return <KeyEntryScreen onPrivateKey={() => {}} />;
    }

    return (
      <WalletHomeScreen
        blsKey={{
          public:
            '0x1234123412341234123412341234123412341234123412341234123412341234',
          private:
            '0x1234123412341234123412341234123412341234123412341234123412341234',
        }}
        wallet={{
          address:
            '0xabcd123412341234123412341234123412341234123412341234123412341234',
          balance: ethers.utils.parseEther('2.035').toString(),
          nonce: '86755',
        }}
      />
    );
  }
}
