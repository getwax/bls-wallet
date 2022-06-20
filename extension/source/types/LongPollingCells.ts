import * as io from 'io-ts';
import { IReadableCell } from '../cells/ICell';
import recordKeys from '../helpers/recordKeys';
import ExplicitAny from './ExplicitAny';

export const longPollingCellMap = {
  blockNumber: io.number,
};

export type LongPollingCellMap = typeof longPollingCellMap;

export type LongPollingCells = {
  [C in keyof LongPollingCellMap]: IReadableCell<
    io.TypeOf<LongPollingCellMap[C]>
  >;
};

export type LongPollingCellName = keyof LongPollingCellMap;

export const LongPollingCellName: io.Type<LongPollingCellName> = io.union(
  recordKeys(longPollingCellMap).map((c) => io.literal(c)) as ExplicitAny,
);
