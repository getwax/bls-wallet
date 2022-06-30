import * as io from 'io-ts';

import { IReadableCell } from '../cells/ICell';
import recordKeys from '../helpers/recordKeys';
import ExplicitAny from './ExplicitAny';
import { ProviderState } from './Rpc';

export const longPollingCellMap = {
  blockNumber: {
    origin: '*',
    Type: io.number,
  },
  providerState: {
    origin: '*',
    Type: ProviderState,
  },
  currencyConversion: {
    origin: '<quill>',
    Type: io.union([io.undefined, io.number]),
  },
};

export type LongPollingCellMap = typeof longPollingCellMap;

export type LongPollingCells = {
  [C in keyof LongPollingCellMap]: IReadableCell<
    io.TypeOf<LongPollingCellMap[C]['Type']>
  >;
};

export type LongPollingCellName = keyof LongPollingCellMap;

export const LongPollingCellName: io.Type<LongPollingCellName> = io.union(
  recordKeys(longPollingCellMap).map((c) => io.literal(c)) as ExplicitAny,
);
