import { FunctionComponent } from 'react';

export const CellsDemoPage2: FunctionComponent = () => {
  return (
    <div
      style={{
        padding: '2em',
        fontSize: '3em',
        lineHeight: '1.5em',
        fontFamily: 'monospace',
      }}
    >
      <table>
        <tbody>
          <tr>
            <td style={{ width: '380px' }}>Hello:</td>
            <td>World</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
