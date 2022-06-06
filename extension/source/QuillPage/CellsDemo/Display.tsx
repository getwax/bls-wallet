import React, { FunctionComponent } from 'react';

import { IReadableCell } from '../../cells/ICell';
import useCell from '../../cells/useCell';

export const Display: FunctionComponent<{
  cell: IReadableCell<unknown>;
}> = ({ cell }) => {
  const value = useCell(cell);
  return <>{value}</>;
};
