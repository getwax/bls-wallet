import { JRPCRequest, Substream } from '@toruslabs/openlogin-jrpc';
import { ethErrors, serializeError } from 'eth-rpc-errors';

const createMetaRPCHandler = (
  api: Record<string, (...args: any[]) => Promise<unknown> | unknown>,
  outStream: Substream,
) => {
  return async (data: JRPCRequest<any>) => {
    if (outStream._writableState.ended) {
      return;
    }
    if (!api[data.method]) {
      outStream.write({
        jsonrpc: '2.0',
        error: ethErrors.rpc.methodNotFound({
          message: `${data.method} not found`,
        }),
        id: data.id,
      });
      return;
    }

    let result;
    let error;
    try {
      result = await api[data.method](...data.params);
    } catch (err) {
      error = err;
    }

    if (outStream._writableState.ended) {
      if (error) {
        console.error(error);
      }
      return;
    }

    if (error) {
      outStream.write({
        jsonrpc: '2.0',
        error: serializeError(error, { shouldIncludeStack: true }),
        id: data.id,
      });
    } else {
      outStream.write({
        jsonrpc: '2.0',
        result,
        id: data.id,
      });
    }
  };
};

export default createMetaRPCHandler;
