import * as React from 'react';
import delay from '../../helpers/delay';
import App from '../App';

type Props = {
  app: App;
};

type Level = 'info' | 'error';

type State = {
  activeCount: number;
  presentCount: number;
  level: Level;
  text: string;
};

const initialState: State = {
  activeCount: 0,
  presentCount: 0,
  level: 'info',
  text: '',
};

export default class NotificationContainer extends React.Component<
  Props,
  State
> {
  targetState = initialState;

  constructor(props: Props) {
    super(props);

    this.state = initialState;
    this.props.app.events.on('notification', this.onNotify);
  }

  onNotify = async (level: 'info' | 'error', text: string): Promise<void> => {
    this.setTarget({
      presentCount: this.targetState.presentCount + 1,
      level,
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
    this.props.app.events.off('notification', this.onNotify);
  }

  setTarget(updates: Partial<State>): void {
    this.targetState = { ...this.targetState, ...updates };

    super.setState(this.targetState);
  }

  render(): React.ReactNode {
    const classes = ['notification', this.state.level];

    if (this.state.activeCount > 0) {
      classes.push('active');
    }

    if (this.state.presentCount > 0) {
      classes.push('present');
    }

    return <div className={classes.join(' ')}>{this.state.text}</div>;
  }
}
