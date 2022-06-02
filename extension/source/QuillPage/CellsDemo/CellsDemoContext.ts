import * as io from 'io-ts';
import { createContext } from 'react';

import { FormulaCell } from '../../cells/FormulaCell';
import MemoryCell from '../../cells/MemoryCell';
import delay from '../../helpers/delay';
import QuillCellCollection from '../QuillCellCollection';

const qcc = new QuillCellCollection();

const a = new MemoryCell(3);
const b = qcc.Cell('b', io.number, 5);

// eslint-disable-next-line @typescript-eslint/no-shadow
const ab = new FormulaCell({ a, b }, ({ a, b }) => a * b);

// eslint-disable-next-line @typescript-eslint/no-shadow
const abSlow = new FormulaCell({ a, b }, async ({ a, b }) => {
  console.log(`calculating ${a}*${b}...`);
  await delay(500);
  const res = a * b;
  console.log(`...${res}`);
  return res;
});

const address = new MemoryCell('');

export default createContext({
  a,
  b,
  ab,
  abSlow,
  address,
  MemoryCell,
  FormulaCell,
  qcc,
});
