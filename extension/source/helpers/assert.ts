export default function assert(
  condition: boolean,
  msg?: string,
): asserts condition {
  if (!condition) {
    // eslint-disable-next-line no-debugger
    debugger;

    throw new Error(msg);
  }
}
