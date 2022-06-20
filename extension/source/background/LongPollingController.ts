import * as io from 'io-ts';

import assertType from '../cells/assertType';
import { IReadableCell } from '../cells/ICell';
import Stoppable from '../cells/Stoppable';
import assert from '../helpers/assert';
import ensureType from '../helpers/ensureType';
import AsyncReturnType from '../types/AsyncReturnType';
import {
  longPollingCellMap,
  LongPollingCellName,
  LongPollingCells,
} from '../types/LongPollingCells';
import optional from '../types/optional';
import { PartialRpcImpl, RpcImpl } from '../types/Rpc';

const maxWaitTime = 300_000;

export default class LongPollingController {
  cancelHandles: Record<string, { cancel: () => void } | undefined> = {};

  constructor(public cells: LongPollingCells) {}

  rpc = ensureType<PartialRpcImpl>()({
    longPoll: async ({
      providerId,
      params: [{ longPollingId, cellName, differentMaybe }],
    }) => {
      const fullLongPollingId = `${providerId}:${longPollingId}`;

      assertType(cellName, LongPollingCellName);

      assertType(
        differentMaybe,
        optional(
          io.type({
            value: longPollingCellMap[cellName].Type as io.Type<unknown>,
          }),
        ),
      );

      const cell: IReadableCell<unknown> = this.cells[cellName];
      const stoppable = new Stoppable<unknown>(cell);
      let res: AsyncReturnType<RpcImpl['longPoll']> = 'please-retry';

      this.cancelHandles[fullLongPollingId] = {
        cancel: () => {
          res = 'cancelled';
          stoppable.stop();
        },
      };

      const timerId = setTimeout(() => stoppable.stop(), maxWaitTime);

      for await (const maybe of stoppable) {
        if (maybe === 'stopped') {
          break;
        }

        if (
          !differentMaybe ||
          cell.hasChanged(differentMaybe.value, maybe.value)
        ) {
          res = { value: maybe.value };
          break;
        }
      }

      clearTimeout(timerId);
      delete this.cancelHandles[fullLongPollingId];

      if (cell.ended) {
        assert(false, new Error(`Unexpected end of ${cellName}`));
      }

      return res;
    },

    longPollCancel: async ({ providerId, params: [{ longPollingId }] }) => {
      const fullLongPollingId = `${providerId}:${longPollingId}`;
      this.cancelHandles[fullLongPollingId]?.cancel();
    },
  });
}
