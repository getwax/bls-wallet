import ExplicitAny from './ExplicitAny';

type AsyncReturnType<T> = T extends (
  ...args: ExplicitAny[]
) => Promise<infer Ret>
  ? Ret
  : never;

export default AsyncReturnType;
