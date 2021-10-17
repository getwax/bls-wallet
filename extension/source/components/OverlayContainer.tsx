import * as React from 'react';
import delay from '../helpers/delay';
import type { PageEvents, PageOverlay } from './Page';

type Props = {
  events: PageEvents;
};

type State = {
  activeCount: number;
  presentCount: number;
  overlayRenders: React.ReactElement[];
};

const initialState: State = {
  activeCount: 0,
  presentCount: 0,
  overlayRenders: [],
};

export default class OverlayContainer extends React.Component<Props, State> {
  targetState = initialState;

  constructor(props: Props) {
    super(props);

    this.state = initialState;
    this.props.events.on('overlay', this.onOverlay);
  }

  onOverlay = async (overlay: PageOverlay): Promise<void> => {
    const overlayRender = overlay(close);
    let isClosed = false;

    this.setTarget({
      overlayRenders: [...this.targetState.overlayRenders, overlayRender],
      presentCount: this.targetState.presentCount + 1,
    });

    await delay(0);
    this.setTarget({ activeCount: this.targetState.activeCount + 1 });

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    async function close() {
      if (isClosed) {
        return;
      }

      isClosed = true;

      self.setTarget({ activeCount: self.targetState.activeCount - 1 });

      await delay(500);

      self.setTarget({
        overlayRenders: self.targetState.overlayRenders.filter(
          (oi) => oi !== overlayRender,
        ),
        presentCount: self.targetState.presentCount - 1,
      });
    }
  };

  componentWillUnmount(): void {
    this.props.events.off('overlay', this.onOverlay);
  }

  setTarget(updates: Partial<State>): void {
    this.targetState = { ...this.targetState, ...updates };

    super.setState(this.targetState);
  }

  render(): React.ReactNode {
    const currentRender = this.state.overlayRenders.slice(-1)[0];

    if (currentRender === undefined) {
      return <></>;
    }

    const classes = ['overlay'];

    if (this.state.activeCount > 0) {
      classes.push('active');
    }

    if (this.state.presentCount > 0) {
      classes.push('present');
    }

    return (
      <div className={classes.join(' ')}>
        <div className="content">{currentRender}</div>
      </div>
    );
  }
}
