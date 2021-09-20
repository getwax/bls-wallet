import * as React from 'react';
import type App from './App';
import KeyEntryScreen from './components/KeyEntryScreen';

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
        <KeyEntryScreen onPrivateKey={() => {}} />
      </div>
    );
  }
}
