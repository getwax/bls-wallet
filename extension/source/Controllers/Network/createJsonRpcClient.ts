import {
  JRPCEngineEndCallback,
  JRPCEngineNextCallback,
  JRPCMiddleware,
  JRPCRequest,
  JRPCResponse,
  mergeMiddleware,
} from '@toruslabs/openlogin-jrpc';

import PollingBlockTracker from '../Block/PollingBlockTracker';
import { ProviderConfig } from '../constants';
import { createFetchMiddleware } from './createFetchMiddleware';
import { providerFromMiddleware } from './INetworkController';

export function createChainIdMiddleware(
  chainId: string,
): JRPCMiddleware<unknown, unknown> {
  return (
    req: JRPCRequest<unknown>,
    res: JRPCResponse<unknown>,
    next: JRPCEngineNextCallback,
    end: JRPCEngineEndCallback,
  ) => {
    if (req.method === 'eth_chainId') {
      res.result = chainId;
      return end();
    }
    return next();
  };
}

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
  blockTracker: PollingBlockTracker;
} {
  const { chainId, rpcTarget } = providerConfig;
  console.log('using provider', providerConfig, rpcTarget);
  const fetchMiddleware = createFetchMiddleware({ rpcTarget });
  const blockProvider = providerFromMiddleware(
    fetchMiddleware as JRPCMiddleware<string[], unknown>,
  );
  const blockTracker = new PollingBlockTracker({
    config: { provider: blockProvider },
    state: {},
  });

  const networkMiddleware = mergeMiddleware([
    createChainIdMiddleware(chainId),
    createProviderConfigMiddleware(providerConfig),
    fetchMiddleware as JRPCMiddleware<unknown, unknown>,
  ]);
  return { networkMiddleware, blockTracker };
}
