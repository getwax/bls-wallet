import {
  createAsyncMiddleware,
  createScaffoldMiddleware,
  JRPCMiddleware,
  JRPCRequest,
  JRPCResponse,
} from '@toruslabs/openlogin-jrpc';
import { BigNumberish, BytesLike } from 'ethers';
import web3_clientVersion from './web3_clientVersion';

type ProviderHandler<Params, Result> = (
  req: JRPCRequest<Params>,
) => Promise<Result>;

function toAsyncMiddleware<Params, Result>(
  method: ProviderHandler<Params, Result>,
) {
  return createAsyncMiddleware(
    async (req: JRPCRequest<Params>, res: JRPCResponse<Result>) => {
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

export type IProviderHandlers = Record<
  string,
  ProviderHandler<unknown, unknown>
>;

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
