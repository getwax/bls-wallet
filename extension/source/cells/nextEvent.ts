import TypedEmitter from 'typed-emitter';
import ExplicitAny from '../types/ExplicitAny';

export default function nextEvent<
  Events extends Record<string, ExplicitAny>,
  E extends keyof Events,
>(
  emitter: TypedEmitter<Events>,
  eventName: E,
): Promise<Parameters<Events[E]>[0]> {
  return new Promise<Parameters<Events[E]>[0]>((resolve) => {
    emitter.once(eventName, resolve as ExplicitAny);
  });
}
