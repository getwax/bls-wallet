import { ChangeEvent, FunctionComponent } from 'react';
import ICell from '../ICell';
import useCell from '../useCell';

const TextBox: FunctionComponent<{ value: ICell<string> }> = ({ value }) => {
  const valueValue = useCell(value) ?? '';

  return (
    <input
      type="text"
      value={valueValue}
      onInput={(evt: ChangeEvent<HTMLInputElement>) =>
        value.write(evt.target.value)
      }
    />
  );
};

export default TextBox;
