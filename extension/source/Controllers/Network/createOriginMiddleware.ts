import {
  JRPCEngineNextCallback,
  JRPCRequest,
  JRPCResponse,
} from '@toruslabs/openlogin-jrpc';

export interface OriginMiddlewareOptions {
  origin: string;
}
export function createOriginMiddleware(options: OriginMiddlewareOptions) {
  return function originMiddleware(
    request: JRPCRequest<unknown>,
    _: JRPCResponse<unknown>,
    next: JRPCEngineNextCallback,
  ): void {
    // TODO (merge-ok) Add JRPCRequest type with origin property added.
    (request as any).origin = options.origin;
    next();
  };
}
