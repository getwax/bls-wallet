import * as React from 'react';
import TypedEventEmitter from 'typed-emitter';

import NotificationContainer from './NotificationContainer';
import OverlayContainer from './OverlayContainer';
import ScreenContainer from './ScreenContainer';

export type PageOverlay = (close: () => void) => React.ReactElement;

export type PageEventMap = {
  notification(level: 'info' | 'error', text: string): void;
  overlay(overlay: PageOverlay): void;
  screen(screen: React.ReactElement): void;
};

export type PageEvents = TypedEventEmitter<PageEventMap>;

type Props = {
  home: React.ReactElement;
  events: PageEvents;
};

// eslint-disable-next-line @typescript-eslint/ban-types
type State = {};

export default class Popup extends React.Component<Props, State> {
  render(): React.ReactNode {
    return (
      <div className="page">
        <ScreenContainer home={this.props.home} events={this.props.events} />
        <NotificationContainer events={this.props.events} />
        <OverlayContainer events={this.props.events} />
      </div>
    );
  }
}
