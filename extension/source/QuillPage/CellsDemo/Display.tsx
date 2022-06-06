import { FunctionComponent } from 'react';

import { IReadableCell } from '../../cells/ICell';
import useCell from '../../cells/useCell';

export const Display: FunctionComponent<{
  cell: IReadableCell<unknown>;
}> = ({ cell }) => {
  const value = useCell(cell);

  return (
    <pre style={{ display: 'inline-block' }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
};
