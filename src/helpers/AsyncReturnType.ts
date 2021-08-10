// deno-lint-ignore no-explicit-any
type ExplicitAny = any;

type AsyncReturnType<T> = T extends
  (...args: ExplicitAny[]) => Promise<infer Ret> ? Ret
  : never;

export default AsyncReturnType;
