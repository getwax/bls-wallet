import { FunctionComponent } from 'react';
import ICell from '../../cells/ICell';
import useCell from '../../cells/useCell';

const CheckBox: FunctionComponent<{ cell: ICell<boolean> }> = ({ cell }) => {
  const value = useCell(cell);

  if (value === undefined) {
    return <></>;
  }

  return (
    <input
      type="checkbox"
      checked={value}
      onChange={() => cell.write(!value)}
      style={{ width: 'initial' }}
    />
  );
};

export default CheckBox;
