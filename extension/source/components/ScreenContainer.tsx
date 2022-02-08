import { Component, ReactElement, ReactNode } from 'react';

import Button from './Button';
// import DefaultScreen from '../Popup/components/DefaultScreen';
import OverrideScreen, {
  overrideScreenEnabled,
} from '../Popup/components/OverrideScreen';
import type { PageEvents } from './Page';

type Props = {
  events: PageEvents;
};

type State = {
  screens: ReactElement[];
};

const initialState: State = {
  screens: [],
};

export default class ScreenContainer extends Component<Props, State> {
  targetState = initialState;

  constructor(props: Props) {
    super(props);

    this.state = initialState;

    if (overrideScreenEnabled) {
      this.state.screens.push(<OverrideScreen key={1} />);
    }

    this.props.events.on('screen', this.onScreen);
  }

  onScreen = async (screen: ReactElement): Promise<void> => {
    this.setTarget({
      screens: [...this.targetState.screens, screen],
    });
  };

  componentWillUnmount(): void {
    this.props.events.off('screen', this.onScreen);
  }

  setTarget(updates: Partial<State>): void {
    this.targetState = { ...this.targetState, ...updates };

    super.setState(this.targetState);
  }

  back(): void {
    const newScreens = this.targetState.screens.slice();
    newScreens.pop();

    this.setTarget({
      screens: newScreens,
    });
  }

  render(): ReactNode {
    const currentScreen =
      this.state.screens.slice(-1)[0] ?? this.props.children;

    return (
      <div className="screen">
        {currentScreen}
        {(() => {
          if (this.state.screens.length === 0) {
            return <></>;
          }

          return (
            <div className="back-container">
              <Button onPress={() => this.back()}>Back</Button>
            </div>
          );
        })()}
      </div>
    );
  }
}
