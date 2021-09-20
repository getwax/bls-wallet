import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

import './figmaTesting.scss';

const FigmaTesting = (): React.ReactElement => (
  <div className="popup">
    <div className="container">
      <div className="logo">
        <img
          src={browser.runtime.getURL('assets/logo.svg')}
          alt="Quill"
          width="80"
          height="56"
        />
      </div>
      <div className="e8_193">
        <span className="e8_194">Create BLS Key</span>
      </div>
      <span className="e8_195">OR</span>
      <div className="e37_222">
        <span className="e37_223">Paste BLS Private Key...</span>
      </div>
      <div className="e162_443">
        <span className="e162_442">
          Quill is in Alpha phase of development, please do not to use large
          sums of money
        </span>
      </div>
    </div>
  </div>
);

export default FigmaTesting;
