import addErrorContext from '../common/addErrorContext';
import RpcMap from '../common/RpcMap';
import validateOptionalStringRecord from '../common/validateOptionalStringRecord';
import promptUser from './promptUser';

export default function RequestHandler(): (
  ...args: unknown[]
) => Promise<unknown> {
  const handlerMap: {
    [M in keyof RpcMap]: {
      validate: (params: unknown) => RpcMap[M]['params'];
      handle: (...params: RpcMap[M]['params']) => Promise<RpcMap[M]['result']>;
    };
  } = {
    eth_sendTransaction: {
      validate: (value: unknown) => {
        if (!Array.isArray(value) || value.length < 1) {
          throw new Error('Expected array with at least one element');
        }

        return [
          validateOptionalStringRecord([
            'nonce',
            'gasPrice',
            'gas',
            'to',
            'from',
            'value',
            'data',
            'chainId',
          ] as const)(value[0]),
        ];
      },
      handle: async () => {
        const promptResult = await promptUser({
          promptText: 'Allow eth_sendTransaction?',
        });

        throw new Error('Not implemented');
      },
    },
    add: {
      validate: (params) => {
        if (!Array.isArray(params)) {
          throw new Error('Expected array');
        }

        if (params.length !== 2) {
          throw new Error('Expected two elements');
        }

        const [a, b] = params;

        if (typeof a !== 'number' || typeof b !== 'number') {
          throw new Error('Expected numbers');
        }

        return [a, b];
      },
      handle: async (a, b) => a + b,
    },
  };

  return async (...args) => {
    if (args.length !== 1) {
      throw new Error('Expected one argument');
    }

    const [request] = args;

    if (typeof request !== 'object' || request === null) {
      throw new Error('Expected an object');
    }

    const requestRecord = request as Record<string, unknown>;

    const { method } = requestRecord;

    if (typeof method !== 'string') {
      throw new Error('Expected method string');
    }

    if (!Object.keys(handlerMap).includes(method)) {
      throw new Error(`Unrecognized method: ${method}`);
    }

    const validMethod = method as keyof typeof handlerMap;

    const validParams = addErrorContext(`${method} params`, () =>
      handlerMap[validMethod].validate(requestRecord.params),
    )();

    return await handlerMap[validMethod].handle(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(validParams as any),
    );
  };
}
