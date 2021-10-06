import * as React from 'react';
import TaskQueue from '../common/TaskQueue';

import type App from './App';
import { AppState } from './App';
import LoadingScreen from './components/LoadingScreen';
import NotificationContainer from '../components/NotificationContainer';
import OverlayContainer from '../components/OverlayContainer';
import ScreenContainer from '../components/ScreenContainer';
import DefaultScreen from './components/DefaultScreen';

type Props = {
  appPromise: Promise<App>;
};

type State = {
  app?: App;
  appState?: AppState;
};

export default class Popup extends React.Component<Props, State> {
  cleanupTasks = new TaskQueue();

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
    this.cleanupTasks.run();
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
        <ScreenContainer
          home={<DefaultScreen app={this.state.app} />}
          events={this.state.app.pageEvents}
        />
        <NotificationContainer events={this.state.app.pageEvents} />
        <OverlayContainer events={this.state.app.pageEvents} />
      </div>
    );
  }
}
