import {
  ChangeEvent,
  DetailedHTMLProps,
  FunctionComponent,
  InputHTMLAttributes,
} from 'react';
import ICell from '../ICell';
import useCell from '../useCell';

const TextBox: FunctionComponent<
  { value: ICell<string> } & Omit<
    Partial<
      DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>
    >,
    'type' | 'value' | 'onInput'
  >
> = ({ value, ...inputProps }) => {
  const valueValue = useCell(value) ?? '';

  return (
    <input
      {...inputProps}
      type="text"
      value={valueValue}
      onInput={(evt: ChangeEvent<HTMLInputElement>) =>
        value.write(evt.target.value)
      }
    />
  );
};

export default TextBox;
