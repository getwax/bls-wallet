import { FunctionComponent } from 'react';

import { IReadableCell } from '../../cells/ICell';
import mapValues from '../../helpers/mapValues';
import useReadableCell from '../../cells/useReadableCell';

export const CellDisplay: FunctionComponent<{
  cells: Record<string, IReadableCell<unknown>>;
}> = ({ cells }) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const values = mapValues(cells, (c) => useReadableCell(c));

  return (
    <pre style={{ display: 'inline-block' }}>
      {Object.entries(values)
        .map(([k, v]) => `${k}: ${JSON.stringify(v, null, 2)}`)
        .join('\n')}
    </pre>
  );
};
