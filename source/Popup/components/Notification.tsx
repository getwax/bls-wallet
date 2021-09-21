import * as React from 'react';
import UiEvents from '../UiEvents';

type Props = {
  uie: UiEvents;
};

type State = {
  activeCount: number;
  presentCount: number;
  text: string;
};

const initialState: State = {
  activeCount: 0,
  presentCount: 0,
  text: '',
};

export default class Notification extends React.Component<Props, State> {
  targetState = initialState;

  constructor(props: Props) {
    super(props);

    this.state = initialState;
    this.props.uie.on('notification', this.onNotify);
  }

  onNotify = async (text: string): Promise<void> => {
    this.setTarget({
      presentCount: this.targetState.presentCount + 1,
      text,
    });

    await delay(0);
    this.setTarget({ activeCount: this.targetState.activeCount + 1 });

    await delay(3000);
    this.setTarget({ activeCount: this.targetState.activeCount - 1 });

    await delay(500);
    this.setTarget({ presentCount: this.targetState.presentCount - 1 });
  };

  componentWillUnmount(): void {
    this.props.uie.off('notification', this.onNotify);
  }

  setTarget(updates: Partial<State>): void {
    this.targetState = { ...this.targetState, ...updates };

    super.setState(this.targetState);
  }

  render(): React.ReactNode {
    const classes = ['notification'];

    if (this.state.activeCount > 0) {
      classes.push('active');
    }

    if (this.state.presentCount > 0) {
      classes.push('present');
    }

    return <div className={classes.join(' ')}>{this.state.text}</div>;
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
