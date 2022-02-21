import { Component, ReactNode } from 'react';
import App from '../../App';
import Button from '../../components/Button';

import LargeQuillHeading from './LargeQuillHeading';

type Props = {
  app: App;
};

type State = {
  pasteText: string;
};

export default class KeyEntryScreen extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      pasteText: '',
    };
  }

  render(): ReactNode {
    return (
      <div className="key-entry-screen">
        <LargeQuillHeading />
        <div className="body">
          <Button
            className={this.state.pasteText === '' ? 'btn-primary' : 'btn'}
            onPress={() => this.props.app.createPrivateKey()}
          >
            Create BLS Key
          </Button>
          <div style={{ color: '#ccc' }}>OR</div>
          <div style={{ flexGrow: 1, position: 'relative' }}>
            <textarea
              placeholder="Paste BLS Private Key..."
              value={this.state.pasteText}
              onInput={(evt) => {
                this.setState({
                  pasteText: (evt.target as HTMLTextAreaElement).value,
                });
              }}
            />
            <div
              className="restore-button"
              style={this.state.pasteText === '' ? { display: 'none' } : {}}
            >
              <Button
                className="btn-primary"
                onPress={() =>
                  this.props.app.loadPrivateKey(this.state.pasteText)
                }
              >
                Restore
              </Button>
            </div>
          </div>
          <div className="notice">
            Quill&apos;s development is in Alpha, please do not to use large
            sums of money
          </div>
        </div>
      </div>
    );
  }
}
