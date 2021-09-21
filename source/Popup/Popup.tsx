import { ethers } from 'ethers';
import * as React from 'react';
import type App from './App';
import { AppState } from './App';
import CommonUI from './CommonUI';
import KeyEntryScreen from './components/KeyEntryScreen';
import LoadingScreen from './components/LoadingScreen';
import Notification from './components/Notification';
import WalletHomeScreen from './components/WalletHomeScreen';

import './styles.scss';

type Props = {
  appPromise: Promise<App>;
};

type State = {
  app?: App;
  appState?: AppState;
  notification?: string;
};

export default class Popup extends React.Component<Props, State> {
  ui = new CommonUI();
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

    this.ui.events.on('notify', (text) => {
      this.setState({
        notification: text,
      });
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
      <>
        <WalletHomeScreen
          ui={this.ui}
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
        <Notification ui={this.ui} />
      </>
    );
  }
}
