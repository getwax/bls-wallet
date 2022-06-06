import TypedEmitter from 'typed-emitter';
import ExplicitAny from '../types/ExplicitAny';

export default async function raceWithEvent<
  PromiseResult,
  EventResult,
  Events extends Record<string, ExplicitAny>,
  E extends keyof Events,
>(
  promise: Promise<PromiseResult>,
  emitter: TypedEmitter<Events>,
  eventName: E,
  listener: (...params: Parameters<Events[E]>) => EventResult,
): Promise<PromiseResult | EventResult> {
  const result = Promise.race([
    promise,
    new Promise<EventResult>((resolve) => {
      const wrappedListener = (...params: Parameters<Events[E]>) => {
        resolve(listener(...params));
      };

      emitter.once(eventName, wrappedListener as ExplicitAny);

      promise.finally(() =>
        emitter.off(eventName, wrappedListener as ExplicitAny),
      );
    }),
  ]);

  return result;
}
