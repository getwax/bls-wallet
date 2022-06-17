// TODO: This is a hack. The only reason you might have a legitimate reason to
// do this is if you're interacting with bad code that's not in your control.
// That's not the case for us.

export default function createSwappableProxy<T extends object>(
  initialTarget: T,
): T {
  let target = initialTarget;

  let setTarget = (newTarget: T) => {
    target = newTarget;
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
