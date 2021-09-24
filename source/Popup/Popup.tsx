import * as React from 'react';

import type App from './App';
import { AppState } from './App';
import LoadingScreen from './components/LoadingScreen';
import NotificationContainer from './components/NotificationContainer';
import OverlayContainer from './components/OverlayContainer';
import ScreenContainer from './components/ScreenContainer';

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
    if (!this.state.app) {
      return (
        <div className="popup">
          <LoadingScreen />
        </div>
      );
    }

    return (
      <div className="popup">
        <ScreenContainer app={this.state.app} />
        <NotificationContainer app={this.state.app} />
        <OverlayContainer app={this.state.app} />
      </div>
    );
  }
}
