import * as React from 'react';
import type App from './App';
import { AppState } from './App';
import UiEvents from './UiEvents';
import KeyEntryScreen from './components/KeyEntryScreen';
import LoadingScreen from './components/LoadingScreen';
import Notification from './components/Notification';
import WalletHomeScreen from './components/WalletHomeScreen';

import './styles.scss';
import OverlayContainer from './components/OverlayContainer';

type Props = {
  appPromise: Promise<App>;
};

type State = {
  app?: App;
  appState?: AppState;
  notification?: string;
};

export default class Popup extends React.Component<Props, State> {
  uie = UiEvents();
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

    this.uie.on('notification', (text) => {
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
    return (
      <div className="popup">
        {this.renderContent()}

        <Notification uie={this.uie} />
        <OverlayContainer uie={this.uie} />
      </div>
    );
  }

  renderContent(): React.ReactNode {
    if (!this.state.appState) {
      return <LoadingScreen />;
    }

    if (this.state.appState.privateKey === undefined) {
      return <KeyEntryScreen onPrivateKey={() => {}} />;
    }

    let wallet: undefined | { address: string; balance: string; nonce: string };

    if (this.state.appState.walletAddress.value !== undefined) {
      wallet = {
        address: this.state.appState.walletAddress.value,
        balance: this.state.appState.walletState.balance ?? '',
        nonce: this.state.appState.walletState.nonce ?? '',
      };
    }

    return (
      <WalletHomeScreen
        uie={this.uie}
        blsKey={{
          public: this.state.app?.PublicKey()!,
          private: this.state.appState.privateKey,
        }}
        wallet={wallet}
      />
    );
  }
}
