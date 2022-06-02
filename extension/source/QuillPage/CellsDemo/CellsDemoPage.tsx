import { FunctionComponent, useContext } from 'react';
import useReadableCell from '../../cells/useReadableCell';
import CellsDemoContext from './CellsDemoContext';

export const CellsDemoPage: FunctionComponent = () => {
  const ctx = useContext(CellsDemoContext);
  const ab = useReadableCell(ctx.ab);

  exposeConsoleCtx(ctx);

  return <>ab: {ab}</>;
};

function exposeConsoleCtx(ctx: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windowAny = window as any;

  if (!windowAny.ctx) {
    windowAny.ctx = ctx;
  }
}
