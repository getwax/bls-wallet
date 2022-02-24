import BaseController from './BaseController';
import { BaseConfig, BaseState } from './interfaces';

const filterNoop = () => true;
const internalEvents = ['newListener', 'removeListener'];
const externalEventFilter = (name: string) => !internalEvents.includes(name);

interface EventEmitterProxyOpts {
  eventFilter?: ((name: string) => boolean) | string;
}

function getRawListeners<
  C extends BaseConfig,
  S extends BaseState,
  T extends BaseController<C, S>,
>(eventEmitter: T, name: string) {
  // prefer native
  return eventEmitter.rawListeners(name);
}

export default function createEventEmitterProxy<
  C extends BaseConfig,
  S extends BaseState,
  T extends BaseController<C, S>,
>(initialTarget: T, opts?: EventEmitterProxyOpts): T {
  // parse options
  const finalOpts = opts || {};
  let eventFilter = finalOpts.eventFilter || filterNoop;
  if (typeof eventFilter === 'string' && eventFilter === 'skipInternal')
    eventFilter = externalEventFilter;
  if (typeof eventFilter !== 'function')
    throw new Error('createEventEmitterProxy - Invalid eventFilter');

  let target = initialTarget;

  let setTarget = (newTarget: T) => {
    const oldTarget = target;
    target = newTarget;

    oldTarget
      .eventNames()
      .filter(eventFilter as (name: string | symbol) => boolean)
      .forEach((name: string | symbol) => {
        getRawListeners(oldTarget, name as string).forEach(
          // eslint-disable-next-line @typescript-eslint/ban-types
          (handler: Function) =>
            newTarget.on(name, handler as unknown as (...args: any[]) => void),
        );
      });

    // remove old listeners
    oldTarget.removeAllListeners();
  };

  const proxy = new Proxy<T>({} as T, {
    get: (_, name) => {
      // override `setTarget` access
      if (name === 'setTarget') return setTarget;
      return (target as any)[name];
    },
    set: (_, name, value) => {
      // allow `setTarget` overrides
      if (name === 'setTarget') {
        setTarget = value;
        return true;
      }
      (target as any)[name] = value;
      return true;
    },
  });

  return proxy;
}
