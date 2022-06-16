export default function assert(
  condition: boolean,
  msg?: string,
): asserts condition {
  if (!condition) {
    if (window.ethereum?.breakOnAssertionFailures) {
      // eslint-disable-next-line no-debugger
      debugger;
    }

    throw new Error(msg);
  }
}
