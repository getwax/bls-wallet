// TODO: Probably all of our raw `throw new Error(...)` examples should be
// asserts.

/**
 * Asserts that the condition is true. The meaning of an assertion is that it is
 * expected to never fail.
 *
 * For this reason, it is often a good idea for the debugger to stop on an
 * assertion failure. In Quill, you can configure this in Developer Settings.
 *
 * (In contrast to simply asking the debugger to stop on all exceptions, which
 * often leads to many false positives from third party libraries which use
 * exceptions for control flow.)
 *
 * The return type `asserts condition` is also incredibly useful. This tells
 * the TypeScript compiler that the code beneath the assertion is unreachable
 * unless the condition is true. This allows you to write code such as the
 * following:
 *
 * ```ts
 * function shoutExternalString(
 *   // externalString is `unknown` because it comes from outside our app
 *   externalString: unknown,
 * ) {
 *   assert(typeof externalString === 'string');
 *
 *   // .toUpperCase() would fail compilation without the assert above.
 *   console.log(externalString.toUpperCase());
 * }
 * ```
 */
export default function assert(
  condition: boolean,
  msg?: string,
): asserts condition {
  if (!condition) {
    if (window.ethereum?.breakOnAssertionFailures) {
      // eslint-disable-next-line no-debugger
      debugger;
    }

    throw new Error(
      msg === undefined ? 'Assertion failed' : `Assertion failed: ${msg}`,
    );
  }
}

/**
 * Similar to `assert` but does not throw.
 *
 * This means it can't help you with type information but it will be a
 * breakpoint for you if you have configured "Break on assertion failures" in
 * Quill's Developer Settings.
 */
export function softAssert(condition: boolean, msg?: string): void {
  if (!condition) {
    if (window.ethereum?.breakOnAssertionFailures) {
      // eslint-disable-next-line no-debugger
      debugger;
    }

    console.error(
      msg === undefined ? 'Assertion failed' : `Assertion failed: ${msg}`,
    );
  }
}
