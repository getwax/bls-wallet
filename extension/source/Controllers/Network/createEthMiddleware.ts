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
  if (!getAccounts) {
    throw new Error('opts.getAccounts is required');
  }

  if (!requestAccounts) {
    throw new Error('opts.requestAccounts is required');
  }

  if (!getProviderStateFromController) {
    throw new Error('opts.getProviderState is required');
  }

  async function lookupAccounts(
    req: JRPCRequest<unknown>,
    res: JRPCResponse<unknown>,
  ): Promise<void> {
    res.result = await getAccounts(req);
  }

  async function requestAccountsFromProvider(
    req: JRPCRequest<unknown>,
    res: JRPCResponse<unknown>,
  ): Promise<void> {
    res.result = await requestAccounts(req);
  }

  async function getProviderStateFromController(
    req: JRPCRequest<unknown>,
    res: JRPCResponse<unknown>,
  ): Promise<void> {
    res.result = await getProviderState(req);
  }

  async function setPreferredAggregatorWrapper(
    req: JRPCRequest<SendTransactionParams>,
    res: JRPCResponse<unknown>,
  ): Promise<void> {
    res.result = await setPreferredAggregator(req);
  }

  return createScaffoldMiddleware({
    web3_clientVersion,
    // account lookups
    eth_accounts: createAsyncMiddleware(lookupAccounts),
    eth_coinbase: toAsyncMiddleware(eth_coinbase),
    eth_requestAccounts: createAsyncMiddleware(requestAccountsFromProvider),
    [PROVIDER_JRPC_METHODS.GET_PROVIDER_STATE]: createAsyncMiddleware(
      getProviderStateFromController,
    ),
    eth_setPreferredAggregator: createAsyncMiddleware<any, any>(
      setPreferredAggregatorWrapper,
    ),
    eth_sendTransaction: toAsyncMiddleware(eth_sendTransaction),
  });
}
