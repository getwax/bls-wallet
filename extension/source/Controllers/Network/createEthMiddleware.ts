import {
  createAsyncMiddleware,
  createScaffoldMiddleware,
  JRPCMiddleware,
  JRPCRequest,
  JRPCResponse,
} from '@toruslabs/openlogin-jrpc';
import { BigNumberish, BytesLike } from 'ethers';
import { PROVIDER_JRPC_METHODS } from '../../common/constants';
import web3_clientVersion from './web3_clientVersion';

type SimpleHandler = (req: JRPCRequest<unknown>) => Promise<unknown>;

function toAsyncMiddleware(method: SimpleHandler) {
  return createAsyncMiddleware(
    async (req: JRPCRequest<unknown>, res: JRPCResponse<unknown>) => {
      res.result = await method(req);
    },
  );
}

export type SendTransactionParams = {
  from: string;
  to: string;
  gas?: BigNumberish;
  gasPrice?: BigNumberish;
  value?: BigNumberish;
  data: BytesLike;
};

export interface IProviderHandlers {
  getAccounts: (req: JRPCRequest<unknown>) => Promise<string[]>;
  eth_coinbase: SimpleHandler;
  requestAccounts: (req: JRPCRequest<unknown>) => Promise<string[]>;
  getProviderState: (
    req: JRPCRequest<unknown>,
  ) => Promise<{ accounts: string[]; chainId: string; isUnlocked: boolean }>;
  setPreferredAggregator: (req: JRPCRequest<unknown>) => Promise<string>;
  eth_sendTransaction: SimpleHandler;
}

export function createWalletMiddleware({
  getAccounts,
  eth_coinbase,
  requestAccounts,
  getProviderState,
  setPreferredAggregator,
  eth_sendTransaction,
}: IProviderHandlers): JRPCMiddleware<string, unknown> {
  return createScaffoldMiddleware({
    web3_clientVersion,
    // account lookups
    eth_accounts: toAsyncMiddleware(getAccounts),
    eth_coinbase: toAsyncMiddleware(eth_coinbase),
    eth_requestAccounts: toAsyncMiddleware(requestAccounts),
    [PROVIDER_JRPC_METHODS.GET_PROVIDER_STATE]:
      toAsyncMiddleware(getProviderState),
    eth_setPreferredAggregator: toAsyncMiddleware(setPreferredAggregator),
    eth_sendTransaction: toAsyncMiddleware(eth_sendTransaction),
  });
}
