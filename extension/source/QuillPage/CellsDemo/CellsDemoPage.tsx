import { FunctionComponent, useMemo } from 'react';
import { FormulaCell } from '../../cells/FormulaCell';
import MemoryCell from '../../cells/MemoryCell';
import useCell from '../../cells/useCell';
import delay from '../../helpers/delay';
import CheckBox from './CheckBox';
import { Counter } from './Counter';
import { Display } from './Display';

export const CellsDemoPage: FunctionComponent = () => {
  const cells = useMemo(() => {
    const a = new MemoryCell(3);
    const b = new MemoryCell(5);
    const includeSlow = new MemoryCell(true);

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

    return { a, b, includeSlow, ab, abSlow };
  }, []);

  const includeSlowValue = useCell(cells.includeSlow);

  return (
    <div
      style={{
        padding: '2em',
        fontSize: '3em',
        lineHeight: '1.5em',
        fontFamily: 'monospace',
      }}
    >
      <table>
        <tbody>
          <tr>
            <td>a:&nbsp;</td>
            <td>
              <Counter cell={cells.a} />
            </td>
          </tr>
          <tr>
            <td>b:&nbsp;</td>
            <td>
              <Counter cell={cells.b} />
            </td>
          </tr>
          <tr>
            <td>includeSlow: </td>
            <td>
              <CheckBox cell={cells.includeSlow} />
            </td>
          </tr>
          <tr>
            <td>ab: </td>
            <td>
              <Display cell={cells.ab} />
            </td>
          </tr>
          {includeSlowValue && (
            <tr>
              <td>abSlow: </td>
              <td>
                <Display cell={cells.abSlow} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
