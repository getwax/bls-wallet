import React, { FunctionComponent } from 'react';

import { IReadableCell } from '../ICell';
import useCell from '../useCell';

export const Display: FunctionComponent<{
  cell: IReadableCell<unknown>;
}> = ({ cell }) => {
  const value = useCell(cell);
  return <>{value}</>;
};
