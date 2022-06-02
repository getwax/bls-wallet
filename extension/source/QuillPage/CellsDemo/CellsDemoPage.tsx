import { FunctionComponent, useContext } from 'react';
import { CellDisplay } from './CellDisplay';
import CellsDemoContext from './CellsDemoContext';

export const CellsDemoPage: FunctionComponent = () => {
  const ctx = useContext(CellsDemoContext);
  const { ab } = ctx;

  exposeConsoleCtx(ctx);

  return (
    <div
      style={{
        padding: '2em',
        zoom: '300%',
      }}
    >
      <CellDisplay cells={{ ab }} />
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
