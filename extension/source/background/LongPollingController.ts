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
import { PartialRpcImpl, RpcImpl } from '../types/Rpc';

const maxWaitTime = 300_000;

export default class LongPollingController {
  constructor(public cells: LongPollingCells) {}

  rpc = ensureType<PartialRpcImpl>()({
    longPoll: async ({ params: [cellName, opt] }) => {
      assertType(cellName, LongPollingCellName);

      assertType(
        opt,
        io.union([
          io.null,
          io.type({
            differentFrom: longPollingCellMap[cellName] as io.Type<unknown>,
          }),
        ]),
      );

      const cell = this.cells[cellName];
      const stoppable = new Stoppable(cell);
      let res: AsyncReturnType<RpcImpl['longPoll']> = 'please-retry';

      const timerId = setTimeout(() => stoppable.stop(), maxWaitTime);

      for await (const maybe of stoppable) {
        if (maybe === 'stopped') {
          break;
        }

        if (
          !opt ||
          cell.hasChanged(opt.differentFrom as ExplicitAny, maybe.value)
        ) {
          res = { value: maybe.value };
        }
      }

      clearTimeout(timerId);

      if (cell.ended) {
        assert(false, new Error(`Unexpected end of ${cellName}`));
      }

      return res;
    },
  });
}
