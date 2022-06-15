import { FunctionComponent } from 'react';
import DemoTable from './DemoTable';

// Accessible at chrome-extension://<insert extension id>/cellsDemo.html#/demo2

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
