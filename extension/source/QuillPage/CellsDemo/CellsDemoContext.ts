import { createContext } from 'react';
import { FormulaCell } from '../../cells/FormulaCell';
import MemoryCell from '../../cells/MemoryCell';

const a = new MemoryCell(3);
const b = new MemoryCell(5);

// eslint-disable-next-line @typescript-eslint/no-shadow
const ab = new FormulaCell({ a, b }, ({ a, b }) => a * b);

export default createContext({
  a,
  b,
  ab,
  MemoryCell,
  FormulaCell,
});
