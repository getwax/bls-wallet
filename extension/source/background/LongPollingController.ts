import * as io from 'io-ts';

import assertType from '../cells/assertType';
import assert from '../helpers/assert';
import ensureType from '../helpers/ensureType';
import ExplicitAny from '../types/ExplicitAny';
import {
  longPollingCellMap,
  LongPollingCellName,
  LongPollingCells,
} from '../types/LongPollingCells';
import { PartialRpcImpl } from '../types/Rpc';

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

      for await (const value of cell) {
        if (!opt || cell.hasChanged(opt.differentFrom as ExplicitAny, value)) {
          return { value };
        }
      }

      assert(false, new Error(`Unexpected end of ${cellName}`));
    },
  });
}
