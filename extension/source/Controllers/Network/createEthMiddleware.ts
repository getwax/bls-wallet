import {
  createAsyncMiddleware,
  createScaffoldMiddleware,
  JRPCMiddleware,
  JRPCRequest,
  JRPCResponse,
} from '@toruslabs/openlogin-jrpc';

export interface IProviderHandlers {
  version: string;
  getAccounts: (req: JRPCRequest<unknown>) => Promise<string[]>;
}

export function createWalletMiddleware({
  version,
  getAccounts,
}: IProviderHandlers): JRPCMiddleware<string, unknown> {
  if (!getAccounts) {
    throw new Error('opts.getAccounts is required');
  }

  async function lookupAccounts(
    req: JRPCRequest<unknown>,
    res: JRPCResponse<unknown>,
  ): Promise<void> {
    res.result = await getAccounts(req);
  }

  async function lookupDefaultAccount(
    req: JRPCRequest<unknown>,
    res: JRPCResponse<unknown>,
  ): Promise<void> {
    const accounts = await getAccounts(req);
    res.result = accounts[0] || null;
  }

  return createScaffoldMiddleware({
    web3_clientVersion: `Quill/v${version}`,
    // account lookups
    eth_accounts: createAsyncMiddleware(lookupAccounts),
    eth_coinbase: createAsyncMiddleware(lookupDefaultAccount),
  });
}
