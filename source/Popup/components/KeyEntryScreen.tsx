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
      <div>
        <LargeQuillHeading />
        <div className="body">
          <div className="button">Create BLS Key</div>
        </div>
      </div>
    );
  }
}
