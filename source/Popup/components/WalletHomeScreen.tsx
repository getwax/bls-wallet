import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

import CompactQuillHeading from './CompactQuillHeading';

const WalletHomeScreen = (): React.ReactElement => (
  <div className="wallet-home-screen">
    <div className="section">
      <CompactQuillHeading />
    </div>
    <div className="section">
      <div className="field-list">
        <div>
          <div style={{ width: '17px' }}>
            <img
              src={browser.runtime.getURL('assets/key.svg')}
              alt="key"
              width="14"
              height="15"
            />
          </div>
          <div className="field-label">BLS Key:</div>
          <div className="field-value grow">(value)</div>
          <div className="field-trailer">
            <img
              src={browser.runtime.getURL('assets/download.svg')}
              alt="download"
              width="22"
              height="22"
            />
            <img
              src={browser.runtime.getURL('assets/trashcan.svg')}
              alt="delete"
              width="22"
              height="22"
            />
          </div>
        </div>
        <div>
          <div style={{ width: '17px' }}>
            <img
              src={browser.runtime.getURL('assets/network.svg')}
              alt="network"
              width="14"
              height="15"
            />
          </div>
          <div className="field-label">Network:</div>
          <div className="field-value">(dropdown)</div>
        </div>
        <div>
          <div style={{ width: '17px' }}>
            <img
              src={browser.runtime.getURL('assets/address.svg')}
              alt="address"
              width="14"
              height="15"
            />
          </div>
          <div className="field-label">Address:</div>
          <div className="field-value grow">(value)</div>
          <div className="field-trailer">#86755</div>
        </div>
      </div>
    </div>
  </div>
);

export default WalletHomeScreen;
