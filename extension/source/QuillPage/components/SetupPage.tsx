import * as React from 'react';

import SetupActionPanel from './SetupActionPanel';
import SetupInfoPanel from './SetupInfoPanel';

const SetupPage: React.FunctionComponent<{ pageIndex: number }> = ({
  pageIndex,
}) => (
  <div className="setup-page quick-row" style={{ height: '100vh' }}>
    <SetupInfoPanel pageIndex={pageIndex} />
    <SetupActionPanel pageIndex={pageIndex} />
  </div>
);

export default SetupPage;
