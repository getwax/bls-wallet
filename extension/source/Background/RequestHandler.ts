import { BigNumber } from 'ethers';

import App from '../App';
import addErrorContext from '../common/addErrorContext';
import RpcMap from '../common/RpcMap';
import validateOptionalStringRecord from '../common/validateOptionalStringRecord';
import promptUser from './promptUser';

export default function RequestHandler(
  app: App,
): (...args: unknown[]) => Promise<unknown> {
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
      handle: async (tx) => {
        if (tx.to === undefined) {
          throw new Error(
            'Not implemented: "to" field missing (can be used for contract creation)',
          );
        }

        if (!/^0x[0-9a-f]*$/i.test(tx.to) || tx.to.length !== 42) {
          throw new Error('"to" field is not a valid address');
        }

        if (tx.value === undefined) {
          throw new Error('Not implemented: "value" field missing');
        }

        if (tx.data === undefined) {
          throw new Error('Not implemented: "function data" field missing');
        }

        if (app.wallet === undefined) {
          throw new Error('No wallet available');
        }

        const promptText = `
            &to=${tx.to}
            &data=${tx.data}
            &value=${tx.value}`;

        const promptResult = await promptUser({
          promptText,
        });

        if (promptResult !== 'Yes') {
          throw new Error('Denied by user');
        }

        const bundle = app.wallet.sign({
          nonce: await app.wallet.Nonce(),
          actions: [
            {
              ethValue: BigNumber.from(tx.value),
              contractAddress: tx.to,
              encodedFunction: tx.data,
            },
          ],
        });
        const failures = await app.aggregator.add(bundle);

        if (failures.length > 0) {
          throw new Error(
            `Failures from aggregator: ${failures
              .map((f) => f.description)
              .join(', ')}`,
          );
        }

        return 'Sent! (TODO: transaction receipt)';
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
