import {
  createAsyncMiddleware,
  createScaffoldMiddleware,
  JRPCMiddleware,
  JRPCRequest,
  JRPCResponse,
} from '@toruslabs/openlogin-jrpc';
import { BigNumberish, BytesLike } from 'ethers';
import web3_clientVersion from './web3_clientVersion';

type ProviderHandler = (req: JRPCRequest<unknown>) => Promise<unknown>;

function toAsyncMiddleware(method: ProviderHandler) {
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

export type IProviderHandlers = Record<string, ProviderHandler>;

export function createWalletMiddleware(
  handlers: IProviderHandlers,
): JRPCMiddleware<string, unknown> {
  const asyncMiddlewares = Object.fromEntries(
    Object.keys(handlers).map((method) => [
      method,
      toAsyncMiddleware(handlers[method]),
    ]),
  );

  return createScaffoldMiddleware({ web3_clientVersion, ...asyncMiddlewares });
}
