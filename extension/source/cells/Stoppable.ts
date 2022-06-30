import { EventEmitter } from 'events';
import { once } from 'lodash-es';
import TypedEmitter from 'typed-emitter';
import ExplicitAny from '../types/ExplicitAny';
import raceWithEvent from './raceWithEvent';

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

  [Symbol.asyncIterator](): AsyncIterator<{ value: T } | 'stopped'> {
    const aiIterator = this.asyncIterable[Symbol.asyncIterator]();
    const aiIteratorReturn = once(() => aiIterator.return?.());

    return {
      next: async () => {
        if (this.stopped) {
          return { value: 'stopped', done: true };
        }

        return raceWithEvent(
          aiIterator
            .next()
            .then(({ value, done }) => ({ value: { value }, done })),
          this.events,
          'stopped',
          () => {
            aiIteratorReturn();
            return { value: 'stopped', done: true };
          },
        );
      },
      return() {
        return aiIteratorReturn() as ExplicitAny;
      },
    };
  }
}
