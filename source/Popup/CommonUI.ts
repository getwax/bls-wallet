import { EventEmitter } from 'events';
import TypedEventEmitter from 'typed-emitter';

type Events = {
  notify: (text: string) => void;
};

export default class CommonUI {
  events = new EventEmitter() as TypedEventEmitter<Events>;

  notify(text: string): void {
    this.events.emit('notify', text);
  }
}
