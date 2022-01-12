import * as React from 'react';

import QuickColumn from './QuickColumn';

const SetupInfoPanel: React.FunctionComponent<{ pageIndex: number }> = ({
  pageIndex,
}) => (
  <QuickColumn>
    <div className="artwork" />
    <div className="info-text">
      <h3>What is Quill?</h3>
      <p>
        The world is changing and Quill will be your co-pilot as you engage with
        many new and exciting opportunities provided by the Ethereum blockchain.
      </p>
    </div>
    <div className="logo-footer" />
  </QuickColumn>
);

export default SetupInfoPanel;
