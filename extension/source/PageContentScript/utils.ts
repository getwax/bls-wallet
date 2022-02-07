import {
  JRPCEngineNextCallback,
  JRPCMiddleware,
  JRPCRequest,
  JRPCResponse,
  SafeEventEmitter,
} from '@toruslabs/openlogin-jrpc';
import { ethErrors } from 'eth-rpc-errors';

/**
 * json-rpc-engine middleware that logs RPC errors and and validates req.method.
 *
 * @param log - The logging API to use.
 * @returns  json-rpc-engine middleware function
 */
export function createErrorMiddleware(): JRPCMiddleware<unknown, unknown> {
  return (
    req: JRPCRequest<unknown>,
    res: JRPCResponse<unknown>,
    next: JRPCEngineNextCallback,
  ) => {
    // json-rpc-engine will terminate the request when it notices this error
    if (typeof req.method !== 'string' || !req.method) {
      res.error = ethErrors.rpc.invalidRequest({
        message: `The request 'method' must be a non-empty string.`,
        data: req,
      });
    }

    next((done) => {
      const { error } = res;
      if (!error) {
        return done();
      }
      console.error(`Quill - RPC Error: ${error.message}`, error);
      return done();
    });
  };
}

/**
 * Logs a stream disconnection error. Emits an 'error' if given an
 * EventEmitter that has listeners for the 'error' event.
 *
 * @param log - The logging API to use.
 * @param remoteLabel - The label of the disconnected stream.
 * @param error - The associated error to log.
 * @param emitter - The logging API to use.
 */
export function logStreamDisconnectWarning(
  remoteLabel: string,
  error: Error,
  emitter: SafeEventEmitter,
): void {
  let warningMsg = `Quill: Lost connection to "${remoteLabel}".`;
  if (error?.stack) {
    warningMsg += `\n${error.stack}`;
  }
  console.warn(warningMsg);
  if (emitter && emitter.listenerCount('error') > 0) {
    emitter.emit('error', warningMsg);
  }
}
