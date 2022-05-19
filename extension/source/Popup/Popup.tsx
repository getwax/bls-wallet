import { Component, ReactNode } from 'react';
import TaskQueue from '../common/TaskQueue';

import type App from '../App';
import { AppState } from '../App';
import LoadingScreen from './components/LoadingScreen';
import Page from '../components/Page';
import WelcomeScreen from './components/WelcomeScreen';

import '../styles/index.scss';

type Props = {
  appPromise: Promise<App>;
};

type State = {
  app?: App;
  appState?: AppState;
};

export default class Popup extends Component<Props, State> {
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

  render(): ReactNode {
    if (!this.state.app) {
      return (
        <div className="popup">
          <LoadingScreen />
        </div>
      );
    }

    return (
      <Page classes={['popup']} events={this.state.app.pageEvents}>
        <WelcomeScreen />
      </Page>
    );
  }
}
