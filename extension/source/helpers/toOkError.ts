import assert from './assert';

export type Result<T> =
  | { ok: T }
  | { error: { message: string; stack: string | undefined } };

export type ToOkErrorReturn<T> = T extends PromiseLike<infer PT>
  ? Promise<Result<PT>>
  : Result<T>;

/**
 * Obtains the result of a task without throwing by instead wrapping it as:
 * - { ok: (resolved value) } if resolved, or
 * - { error: { message, stack } } if rejected.
 *
 * Also handles promises by returning a promise that always resolves as above.
 */
export default function toOkError<T>(
  task: () => T,
  log = true,
): ToOkErrorReturn<T> {
  let taskOutput: T;

  try {
    taskOutput = task();
  } catch (error) {
    return handleError(error, log) as ToOkErrorReturn<T>;
  }

  const isPromiseLike =
    typeof taskOutput === 'object' &&
    taskOutput !== null &&
    'then' in taskOutput &&
    typeof (taskOutput as Record<string, unknown>).then === 'function';

  if (!isPromiseLike) {
    return { ok: taskOutput } as ToOkErrorReturn<T>;
  }

  return (async () => {
    try {
      return { ok: await taskOutput };
    } catch (error) {
      return handleError(error, log);
    }
  })() as ToOkErrorReturn<T>;
}

function handleError(error: unknown, log: boolean) {
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
