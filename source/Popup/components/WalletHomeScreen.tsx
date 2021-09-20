import * as React from 'react';

import CompactQuillHeading from './CompactQuillHeading';

const WalletHomeScreen = (): React.ReactElement => (
  <div className="wallet-home-screen">
    <div className="section">
      <CompactQuillHeading />
    </div>
    <div className="section">
      <div className="field-list">BLS Key:</div>
    </div>
  </div>
);

export default WalletHomeScreen;
