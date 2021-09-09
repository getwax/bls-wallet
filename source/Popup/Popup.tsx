import * as React from 'react';
import type App from './App';
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
    return (
      <div className="popup">
        <div className="heading">Quill 🪶</div>
        <div className="body">{this.renderBody()}</div>
      </div>
    );
  }

  renderBody(): React.ReactNode {
    if (this.state.app) {
      return <StatusView app={this.state.app} />;
    }

    return <>Loading...</>;
  }
}
