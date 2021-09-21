import * as React from 'react';
import type App from './App';
import { AppState } from './App';
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
    if (!this.state.app) {
      return <LoadingScreen />;
    }

    return (
      <div className="popup">
        {this.renderContent(this.state.app)}

        <Notification app={this.state.app} />
        <OverlayContainer app={this.state.app} />
      </div>
    );
  }

  renderContent(app: App): React.ReactNode {
    if (app.state.privateKey === undefined) {
      return <KeyEntryScreen app={app} />;
    }

    return <WalletHomeScreen app={app} />;
  }
}
