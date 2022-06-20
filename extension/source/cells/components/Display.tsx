import { FunctionComponent } from 'react';
import { IReadableCell } from '../ICell';
import useCell from '../useCell';

const Display: FunctionComponent<{ cell: IReadableCell<unknown> }> = ({
  cell,
}) => {
  const value = useCell(cell);
  return <>{value}</>;
};

export default Display;
