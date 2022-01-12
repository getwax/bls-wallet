import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import LogoFooter from './LogoFooter';

import QuickColumn from './QuickColumn';

const SetupInfoPanel: React.FunctionComponent<{ pageIndex: number }> = ({
  pageIndex,
}) => (
  <div className="setup-info-panel quick-column">
    <div
      className="quick-column"
      style={{
        background: `center no-repeat url(${browser.runtime.getURL(
          'assets/info-panel-pretty-curve.svg',
        )})`,
      }}
    >
      <div className="artwork" />
      <div className="info-text">
        <h3>What is Quill?</h3>
        <p>
          The world is changing and Quill will be your co-pilot as you engage
          with many new and exciting opportunities provided by the Ethereum
          blockchain.
        </p>
      </div>
      <LogoFooter />
    </div>
  </div>
);

export default SetupInfoPanel;
