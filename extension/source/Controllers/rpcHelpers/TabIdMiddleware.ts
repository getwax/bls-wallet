import {
  JRPCEngineNextCallback,
  JRPCRequest,
  JRPCResponse,
} from '@toruslabs/openlogin-jrpc';

export default function createTabIdMiddleware({ tabId }: { tabId: number }) {
  return function tabIdMiddleware(
    req: JRPCRequest<unknown>,
    _: JRPCResponse<unknown>,
    next: JRPCEngineNextCallback,
  ) {
    (req as any).tabId = tabId;
    next();
  };
}
