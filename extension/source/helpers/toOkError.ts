import assert from './assert';

export type Result<T> =
  | { ok: T }
  | { error: { message: string; stack: string | undefined } };

/**
 * Transforms a promise that might reject into one that always resolves:
 * - with { ok: (resolved value) } if resolved, or
 * - with { error: { message, stack } } if rejected
 */
export default async function toOkError<T>(
  promise: Promise<T>,
  log = true,
): Promise<Result<T>> {
  try {
    return { ok: await promise };
  } catch (error) {
    if (log) {
      console.error(error);
    }

    assert(error instanceof Error);

    return {
      error: {
        message: error.message,
        stack: error.stack,
      },
    };
  }
}
