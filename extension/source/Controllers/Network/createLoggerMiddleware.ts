import {
  JRPCEngineNextCallback,
  JRPCRequest,
  JRPCResponse,
} from '@toruslabs/openlogin-jrpc';

export interface LoggerMiddlewareOptions {
  origin: string;
}

export function createLoggerMiddleware(options: LoggerMiddlewareOptions) {
  return function loggerMiddleware(
    request: JRPCRequest<unknown>,
    response: JRPCResponse<unknown>,
    next: JRPCEngineNextCallback,
  ): void {
    next((callback) => {
      if (response.error) {
        console.warn('Error in RPC response:\n', response);
      }
      if ((request as unknown as { isTorusInternal: boolean }).isTorusInternal)
        return;
      console.log(`RPC (${options.origin}):`, request, '->', response);
      callback();
    });
  };
}
