import { FunctionComponent } from 'react';

import { IReadableCell } from '../ICell';
import useCell from '../useCell';

export const DisplayJson: FunctionComponent<{
  cell: IReadableCell<unknown>;
}> = ({ cell }) => {
  const value = useCell(cell);

  return (
    <pre style={{ display: 'inline-block' }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
};
