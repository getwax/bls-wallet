import * as io from 'io-ts';
import { createContext } from 'react';

import { FormulaCell } from '../../cells/FormulaCell';
import MemoryCell from '../../cells/MemoryCell';
import QuillCellCollection from '../QuillCellCollection';

const qcc = new QuillCellCollection();

const a = new MemoryCell(3);
const b = qcc.Cell('b', io.number, 5);

// eslint-disable-next-line @typescript-eslint/no-shadow
const ab = new FormulaCell({ a, b }, ({ a, b }) => a * b);

export default createContext({
  a,
  b,
  ab,
  MemoryCell,
  FormulaCell,
  qcc,
});
