import { EventEmitter } from 'events';
import TypedEventEmitter from 'typed-emitter';

type UiEvents = TypedEventEmitter<{
  notification: (text: string) => void;
}>;

function UiEvents(): UiEvents {
  return new EventEmitter() as UiEvents;
}

export default UiEvents;
