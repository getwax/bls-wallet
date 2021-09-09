import * as React from 'react';
import type App from '../App';
import StatusView from './StatusView';

import './styles.scss';

type Props = {
  appPromise: Promise<App>;
};

type State = {
  app?: App;
};

export default class Popup extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {};

    this.props.appPromise.then((app) => {
      this.setState({ app });
    });
  }

  render(): React.ReactNode {
    if (this.state.app) {
      return (
        <div id="popup">
          <StatusView app={this.state.app} />
        </div>
      );
    }

    return <>Loading...</>;
  }
}
