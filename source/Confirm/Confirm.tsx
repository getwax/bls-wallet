import * as React from 'react';
import Button from '../components/Button';
import CompactQuillHeading from '../components/CompactQuillHeading';

type Props = {
  _?: undefined;
};

type State = {
  _?: undefined;
};

export default class Popup extends React.Component<Props, State> {
  cleanupTasks: (() => void)[] = [];

  constructor(props: Props) {
    super(props);

    this.state = {};
  }

  componentWillUnmount(): void {
    while (true) {
      const task = this.cleanupTasks.shift();

      if (task === undefined) {
        break;
      }

      try {
        task();
      } catch (error) {
        console.error(error);
      }
    }
  }

  render(): React.ReactNode {
    return (
      <div className="confirm">
        <div className="section">
          <CompactQuillHeading />
        </div>
        <div className="section prompt">
          <div>
            {new URL(window.location.href).searchParams.get('promptText') ??
              '(promptText not set)'}
          </div>
          <div />
          <Button highlight={true} onPress={() => {}}>
            Yes
          </Button>
          <Button onPress={() => {}}>No</Button>
        </div>
      </div>
    );
  }
}
