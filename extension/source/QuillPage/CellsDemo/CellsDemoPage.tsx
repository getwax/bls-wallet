import { FunctionComponent, useContext } from 'react';
import { CellDisplay } from './CellDisplay';
import CellsDemoContext from './CellsDemoContext';
import { Counter } from './Counter';

export const CellsDemoPage: FunctionComponent = () => {
  const ctx = useContext(CellsDemoContext);
  const { ab, abSlow } = ctx;

  exposeConsoleCtx(ctx);

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
      <Counter label="a" cell={ctx.a} />
      <Counter label="b" cell={ctx.b} />
      <CellDisplay cells={{ ab, abSlow }} />
    </div>
  );
};

function exposeConsoleCtx(ctx: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windowAny = window as any;

  if (!windowAny.ctx) {
    windowAny.ctx = ctx;
  }
}
