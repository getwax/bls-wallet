import { FunctionComponent } from 'react';
import ICell from '../ICell';
import useCell from '../useCell';

const Selector: FunctionComponent<{
  options: string[];
  selection: ICell<string>;
}> = ({ options, selection }) => {
  const selectionValue = useCell(selection);

  if (selectionValue === undefined) {
    return <></>;
  }

  return (
    <select
      value={selectionValue}
      onChange={(evt) => {
        selection.write(options[evt.target.selectedIndex]);
      }}
      style={{ border: '1px solid black' }}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
};

export default Selector;
