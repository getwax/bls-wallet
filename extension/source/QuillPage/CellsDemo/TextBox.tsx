import { FunctionComponent } from 'react';
import ICell from '../../cells/ICell';
import useCell from '../../cells/useCell';

const TextBox: FunctionComponent<{ value: ICell<string> }> = ({ value }) => {
  const valueValue = useCell(value) ?? '';

  return (
    <input
      type="text"
      value={valueValue}
      onInput={(evt) => value.write((evt.target as HTMLInputElement).value)}
    />
  );
};

export default TextBox;
