import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import TaskQueue from '../common/TaskQueue';
import Button from '../components/Button';
import CompactQuillHeading from '../components/CompactQuillHeading';

type Props = {
  _?: undefined;
};

type State = {
  _?: undefined;
};

export default class Popup extends React.Component<Props, State> {
  cleanupTasks = new TaskQueue();

  constructor(props: Props) {
    super(props);

    this.state = {};
  }

  componentWillUnmount(): void {
    this.cleanupTasks.run();
  }

  render(): React.ReactNode {
    const params = new URL(window.location.href).searchParams;
    const id = params.get('id');
    const promptText = params.get('promptText') ?? '(promptText not set)';
    const buttons = parseButtons(params.get('buttons'));

    return (
      <div className="confirm">
        <div className="section">
          <CompactQuillHeading />
        </div>
        <div className="section prompt">
          <div>{promptText}</div>
          <div />
          {buttons.map((btnText, i) => (
            <Button
              highlight={i === 0}
              onPress={() => {
                browser.runtime.sendMessage(undefined, { id, result: btnText });
              }}
              key={btnText}
            >
              {btnText}
            </Button>
          ))}
        </div>
      </div>
    );
  }
}

function parseButtons(buttonsStr: string | null): string[] {
  if (buttonsStr === null) {
    return ['(buttons not set)'];
  }

  if (buttonsStr === '') {
    return [];
  }

  return buttonsStr.split(',');
}
