import * as React from 'react';
import App from '../App';

type Props = {
  app: App;
};

type State = {
  contractAddressText: string;
};

const initialState: State = {
  contractAddressText: '',
};

export default class TransactionTab extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = initialState;
  }

  render(): React.ReactElement {
    return <>Transaction tab...</>;
  }
}
