import { EventEmitter } from 'events';
import { once } from 'lodash-es';
import TypedEmitter from 'typed-emitter';
import raceWithEvent from './raceEvent';

export default class Stoppable<T> {
  stopped = false;

  events = new EventEmitter() as TypedEmitter<{
    stopped(): void;
  }>;

  constructor(public asyncIterable: AsyncIterable<T>) {}

  stop() {
    if (this.stopped) {
      return;
    }

    this.stopped = true;
    this.events.emit('stopped');
  }

  [Symbol.asyncIterator]() {
    const aiIterator = this.asyncIterable[Symbol.asyncIterator]();
    const aiIteratorReturn = once(() => aiIterator.return?.());

    return {
      next: async () => {
        if (this.stopped) {
          return { value: undefined, done: true };
        }

        return raceWithEvent(aiIterator.next(), this.events, 'stopped', () => {
          aiIteratorReturn();
          return { value: undefined, done: true };
        });
      },
      return() {
        return aiIteratorReturn();
      },
    };
  }
}
