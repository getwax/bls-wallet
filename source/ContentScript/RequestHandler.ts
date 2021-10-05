import RpcMap from '../common/RpcMap';

const notImplemented = {
  validate: (_params: unknown): _params is never => {
    throw new Error('Not implemented');
  },
  handle: async () => {
    throw new Error('Not implemented');
  },
};

export default function RequestHandler(): (
  ...args: unknown[]
) => Promise<unknown> {
  const handlerMap: {
    [M in keyof RpcMap]: {
      validate: (params: unknown) => params is RpcMap[M]['params'];
      handle: (...params: RpcMap[M]['params']) => Promise<RpcMap[M]['result']>;
    };
  } = {
    eth_sendTransaction: notImplemented,
    add: {
      validate: (params): params is [number, number] =>
        Array.isArray(params) &&
        typeof params[0] === 'number' &&
        typeof params[1] === 'number',
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

    const valid = handlerMap[validMethod].validate(requestRecord.params);

    if (!valid) {
      throw new Error('Params not valid');
    }

    return await handlerMap[validMethod].handle(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(requestRecord.params as any),
    );
  };
}
