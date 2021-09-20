import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import type App from './App';
import LargeQuillHeading from './components/LargeQuillHeading';
import StatusView from './StatusView';

import './styles.scss';

type Props = {
  appPromise: Promise<App>;
};

type State = {
  logoUrl?: string;
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
    if (true) {
      return (
        <div className="popup">
          <LargeQuillHeading />
        </div>
      );
    }

    return (
      <div className="popup">
        <div className="heading">
          <img
            src={browser.runtime.getURL('assets/logo.svg')}
            alt="Quill"
            width="79"
            height="46"
          />
        </div>
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
