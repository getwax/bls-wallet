import {
  JRPCEngineEndCallback,
  JRPCEngineNextCallback,
  JRPCMiddleware,
  JRPCRequest,
  JRPCResponse,
  mergeMiddleware,
} from '@toruslabs/openlogin-jrpc';
import { Aggregator } from 'bls-wallet-clients';
import { AGGREGATOR_URL } from '../../env';

import PollingBlockTracker from '../Block/PollingBlockTracker';
import { ProviderConfig } from '../constants';
import knownTransactions from '../knownTransactions';
import { getFirstReqParam } from '../utils';
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

function mockGetTransactionByHashMiddleware(): JRPCMiddleware<
  unknown,
  unknown
> {
  return (
    req: JRPCRequest<unknown>,
    res: JRPCResponse<unknown>,
    next: JRPCEngineNextCallback,
    end: JRPCEngineEndCallback,
  ) => {
    if (req.method === 'eth_getTransactionByHash') {
      const hash = getFirstReqParam<string>(req);

      if (hash in knownTransactions) {
        const knownTx = knownTransactions[hash];

        // Here we're just relaying the information that we already know
        // internally about the transaction. ethers needs this response to
        // function properly.
        res.result = {
          hash,
          from: knownTx.from,
          nonce: knownTx.nonce,
          value: knownTx.value,
          gasLimit: '0x0',
          data: knownTx.data,
        };
        return end();
      }
    }

    return next();
  };
}

function createAggregatorMiddleware(): JRPCMiddleware<unknown, unknown> {
  return async (
    req: JRPCRequest<unknown>,
    res: JRPCResponse<unknown>,
    next: JRPCEngineNextCallback,
    end: JRPCEngineEndCallback,
  ) => {
    if (req.method === 'eth_getTransactionReceipt') {
      const hash = getFirstReqParam<string>(req);

      if (hash in knownTransactions) {
        const knownTx = knownTransactions[hash];

        const aggregator = new Aggregator(AGGREGATOR_URL);
        const bundleReceipt = await aggregator.lookupReceipt(hash);

        if (bundleReceipt === undefined) {
          res.result = null;
          return end();
        }

        res.result = {
          transactionHash: hash,
          transactionIndex: bundleReceipt.transactionIndex,
          blockHash: bundleReceipt.blockHash,
          blockNumber: bundleReceipt.blockNumber,
          from: knownTx.from,
          to: knownTx.to,
          logs: [],
          cumulativeGasUsed: '0x0',
          gasUsed: '0x0',
          status: '0x1',
          effectiveGasPrice: '0x0',
        };

        return end();
      }
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
    mockGetTransactionByHashMiddleware(),
    createAggregatorMiddleware(),
    fetchMiddleware as JRPCMiddleware<unknown, unknown>,
  ]);
  return { networkMiddleware, blockTracker };
}
