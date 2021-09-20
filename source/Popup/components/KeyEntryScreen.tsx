import * as React from 'react';
import Button from './Button';

import LargeQuillHeading from './LargeQuillHeading';

type Props = {
  onPrivateKey: (
    privateKey:
      | { type: 'paste'; value: string }
      | { type: 'create'; value?: null },
  ) => void;
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
          <Button
            onPress={() => this.props.onPrivateKey({ type: 'create' })}
            highlight={this.state.pasteText === ''}
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
                onPress={() =>
                  this.props.onPrivateKey({
                    type: 'paste',
                    value: this.state.pasteText,
                  })
                }
                highlight={true}
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
