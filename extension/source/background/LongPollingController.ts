import * as io from 'io-ts';

import assertType from '../cells/assertType';
import Stoppable from '../cells/Stoppable';
import assert from '../helpers/assert';
import ensureType from '../helpers/ensureType';
import AsyncReturnType from '../types/AsyncReturnType';
import ExplicitAny from '../types/ExplicitAny';
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
            value: longPollingCellMap[cellName] as io.Type<unknown>,
          }),
        ),
      );

      const cell = this.cells[cellName];
      const stoppable = new Stoppable(cell);
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
          cell.hasChanged(differentMaybe.value as ExplicitAny, maybe.value)
        ) {
          res = { value: maybe.value };
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
      const handle = this.cancelHandles[fullLongPollingId];
      assert(handle !== undefined);
      handle.cancel();
    },
  });
}
