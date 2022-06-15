import { FunctionComponent } from 'react';

const DemoTable: FunctionComponent = ({ children }) => {
  return (
    <div
      style={{
        padding: '2em',
        fontSize: '3em',
        lineHeight: '1.5em',
        fontFamily: 'monospace',
      }}
    >
      <table className="demo-table">
        <tbody>
          <tr>
            <td style={{ width: '380px', height: '0' }} />
          </tr>
          {children}
        </tbody>
      </table>
    </div>
  );
};

export default DemoTable;
