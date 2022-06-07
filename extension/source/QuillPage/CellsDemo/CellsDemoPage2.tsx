import { FunctionComponent } from 'react';
import DemoTable from './DemoTable';

export const CellsDemoPage2: FunctionComponent = () => {
  return (
    <DemoTable>
      <tr>
        <td>Hello:</td>
        <td>World</td>
      </tr>
    </DemoTable>
  );
};
