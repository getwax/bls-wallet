import { Component, ReactElement } from 'react';
import App from '../../App';
import formatBalance from '../helpers/formatBalance';

type Props = {
  app: App;
};

type State = {
  contractAddressText: string;
};

const initialState: State = {
  contractAddressText: '',
};

export default class TransactionTab extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = initialState;
  }

  render(): ReactElement {
    return (
      <div className="transaction-tab">
        <div className="balance">
          <div className="label">Balance:</div>
          <div className="value">
            {formatBalance(this.props.app.state.walletState.balance, 'ETH')}
          </div>
        </div>
      </div>
    );
  }
}
