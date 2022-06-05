import { FunctionComponent, useMemo } from 'react';
import { FormulaCell } from '../../cells/FormulaCell';
import MemoryCell from '../../cells/MemoryCell';
import delay from '../../helpers/delay';
import { CellDisplay } from './CellDisplay';
import { Counter } from './Counter';

export const CellsDemoPage: FunctionComponent = () => {
  const cells = useMemo(() => {
    const a = new MemoryCell(3);
    const b = new MemoryCell(5);

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

    return { a, b, ab, abSlow };
  }, []);

  return (
    <div
      style={{
        padding: '2em',
        fontSize: '3em',
        lineHeight: '1em',
        display: 'flex',
        flexDirection: 'column',
        gap: '1em',
      }}
    >
      <Counter label="a" cell={cells.a} />
      <Counter label="b" cell={cells.b} />
      <CellDisplay cells={{ ab: cells.ab, abSlow: cells.abSlow }} />
    </div>
  );
};
