import * as React from 'react';
import UiEvents, { Overlay } from '../UiEvents';

type Props = {
  uie: UiEvents;
};

type State = {
  overlayRenders: React.ReactElement[];
};

const initialState: State = {
  overlayRenders: [],
};

export default class OverlayContainer extends React.Component<Props, State> {
  targetState = initialState;

  constructor(props: Props) {
    super(props);

    this.state = initialState;
    this.props.uie.on('overlay', this.onOverlay);
  }

  onOverlay = async (overlay: Overlay): Promise<void> => {
    const overlayRender = overlay(close);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    function close() {
      self.setTarget({
        overlayRenders: self.targetState.overlayRenders.filter(
          (oi) => oi !== overlayRender,
        ),
      });
    }

    this.setTarget({
      overlayRenders: [...this.targetState.overlayRenders, overlayRender],
    });
  };

  componentWillUnmount(): void {
    this.props.uie.off('overlay', this.onOverlay);
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

    return (
      <div className="overlay">
        <div className="content">{currentRender}</div>
      </div>
    );
  }
}
