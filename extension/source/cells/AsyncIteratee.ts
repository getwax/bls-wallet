type AsyncIteratee<I extends AsyncIterable<unknown>> = I extends AsyncIterable<
  infer T
>
  ? T
  : never;

export default AsyncIteratee;
