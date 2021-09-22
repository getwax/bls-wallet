import * as React from 'react';

import App from '../App';
import Button from './Button';
import DefaultScreen from './DefaultScreen';
import OverrideScreen, { overrideScreenEnabled } from './OverrideScreen';

type Props = {
  app: App;
};

type State = {
  screens: React.ReactElement[];
};

const initialState: State = {
  screens: [],
};

export default class ScreenContainer extends React.Component<Props, State> {
  targetState = initialState;

  constructor(props: Props) {
    super(props);

    this.state = initialState;

    if (overrideScreenEnabled) {
      this.state.screens.push(<OverrideScreen app={props.app} key={1} />);
    }

    this.props.app.events.on('screen', this.onScreen);
  }

  onScreen = async (screen: React.ReactElement): Promise<void> => {
    this.setTarget({
      screens: [...this.targetState.screens, screen],
    });
  };

  componentWillUnmount(): void {
    this.props.app.events.off('screen', this.onScreen);
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

  render(): React.ReactNode {
    const currentScreen = this.state.screens.slice(-1)[0] ?? (
      <DefaultScreen app={this.props.app} />
    );

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
