export class NeverError extends Error {
  constructor(public value: never) {
    super(`Encountered \`never\` type unexpectedly with value ${value}`);
  }
}

export default function never(value: never): never {
  throw new NeverError(value);
}
