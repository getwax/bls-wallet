import * as io from 'io-ts';

import { FunctionComponent, useMemo } from 'react';
import elcc from '../../cells/extensionLocalCellCollection';
import { FormulaCell } from '../../cells/FormulaCell';
import MemoryCell from '../../cells/MemoryCell';
import useCell from '../../cells/useCell';
import delay from '../../helpers/delay';
import Range from '../../helpers/Range';
import QuillContext from '../QuillContext';
import CheckBox from './CheckBox';
import { Counter } from './Counter';
import { Display } from './Display';
import Selector from './Selector';

export const CellsDemoPage: FunctionComponent = () => {
  const quillCtx = QuillContext.use();

  const cells = useMemo(() => {
    const page = new MemoryCell('math');

    const a = elcc.Cell('a', io.number, 3);
    const b = new MemoryCell(5);
    const c = new MemoryCell(0);
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

    return { page, a, b, c, includeSlow, ab, abSlow };
  }, []);

  (window as any).cells = cells;

  const includeSlowValue = useCell(cells.includeSlow);
  const cValue = useCell(cells.c);
  const pageValue = useCell(cells.page);

  if (pageValue === undefined) {
    return <></>;
  }

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
            <td style={{ width: '380px', height: '4em' }}>page</td>
            <td>
              <Selector
                options={['math', 'blockNumber', 'balance']}
                selection={cells.page}
              />
            </td>
          </tr>
          {pageValue === 'math' && (
            <>
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
            </>
          )}
          {pageValue === 'blockNumber' && (
            <>
              <tr>
                <td>c:&nbsp;</td>
                <td>
                  <Counter cell={cells.c} />
                </td>
              </tr>
              {Range(cValue ?? 0).map((i) => (
                <tr key={i}>
                  <td>blockNumber: </td>
                  <td>
                    <Display cell={quillCtx.blockNumber} />
                  </td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
};
