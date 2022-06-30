import * as io from 'io-ts';

import { IReadableCell } from './cells/ICell';
import LongPollingCell from './cells/LongPollingCell';
import RandomId from './helpers/RandomId';
import type QuillEthereumProvider from './QuillEthereumProvider';
import {
  LongPollingCellMap,
  LongPollingCellName,
} from './types/LongPollingCells';

export default function QuillLongPollingCell<C extends LongPollingCellName>(
  ethereum: QuillEthereumProvider,
  cellName: C,
): IReadableCell<io.TypeOf<LongPollingCellMap[C]['Type']>> {
  return LongPollingCell<unknown>((differentMaybe) => {
    const longPollingId = RandomId();

    return {
      resultPromise: ethereum.request({
        method: 'longPoll',
        params: [
          {
            cellName,
            longPollingId,
            differentMaybe,
          },
        ],
      }),
      cancel: () =>
        ethereum.request({
          method: 'longPollCancel',
          params: [{ longPollingId }],
        }),
    };
  }) as IReadableCell<io.TypeOf<LongPollingCellMap[C]['Type']>>;
}
