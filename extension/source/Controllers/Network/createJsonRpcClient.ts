import {
  JRPCEngineEndCallback,
  JRPCEngineNextCallback,
  JRPCMiddleware,
  JRPCRequest,
  JRPCResponse,
  mergeMiddleware,
} from '@toruslabs/openlogin-jrpc';

import { ProviderConfig } from '../constants';
import { createFetchMiddleware } from './createFetchMiddleware';

export function createProviderConfigMiddleware(
  providerConfig: ProviderConfig,
): JRPCMiddleware<unknown, unknown> {
  return (
    req: JRPCRequest<unknown>,
    res: JRPCResponse<unknown>,
    next: JRPCEngineNextCallback,
    end: JRPCEngineEndCallback,
  ) => {
    if (req.method === 'eth_provider_config') {
      res.result = providerConfig;
      return end();
    }
    return next();
  };
}

export function createJsonRpcClient(providerConfig: ProviderConfig): {
  networkMiddleware: JRPCMiddleware<unknown, unknown>;
} {
  const { rpcTarget } = providerConfig;
  console.log('using provider', providerConfig, rpcTarget);
  const fetchMiddleware = createFetchMiddleware({ rpcTarget });

  const networkMiddleware = mergeMiddleware([
    createProviderConfigMiddleware(providerConfig),
    fetchMiddleware as JRPCMiddleware<unknown, unknown>,
  ]);
  return { networkMiddleware };
}
