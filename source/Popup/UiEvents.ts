import { EventEmitter } from 'events';
import * as React from 'react';
import TypedEventEmitter from 'typed-emitter';

export type Overlay = (close: () => void) => React.ReactElement;

type UiEvents = TypedEventEmitter<{
  notification: (text: string) => void;
  overlay: (overlay: Overlay) => void;
}>;

function UiEvents(): UiEvents {
  return new EventEmitter() as UiEvents;
}

export default UiEvents;
