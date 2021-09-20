import * as React from 'react';

import LargeQuillHeading from './LargeQuillHeading';

type Props = {
  onPrivateKey: (privateKey: string) => void;
};

type State = {
  pasteText: string;
};

export default class KeyEntryScreen extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      pasteText: '',
    };
  }

  render(): React.ReactNode {
    return (
      <div className="key-entry-screen">
        <LargeQuillHeading />
        <div className="body">
          <div
            className={`button${
              this.state.pasteText === '' ? ' highlight' : ''
            }`}
          >
            Create BLS Key
          </div>
          <div style={{ color: '#ccc' }}>OR</div>
          <div style={{ flexGrow: 1 }}>
            <textarea
              placeholder="Paste BLS Private Key..."
              value={this.state.pasteText}
              onInput={(evt) => {
                this.setState({
                  pasteText: (evt.target as HTMLTextAreaElement).value,
                });
              }}
            />
          </div>
          <div className="notice">
            Quill is in Alpha phase of development, please do not to use large
            sums of money
          </div>
        </div>
      </div>
    );
  }
}
