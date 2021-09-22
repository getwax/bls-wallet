import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

import '../styles.scss';

const CopyIcon = (): React.ReactElement => (
  <div style={{ position: 'relative', width: '16px', height: '16px' }}>
    <img
      src={browser.runtime.getURL('assets/copy.svg')}
      alt="copy"
      width="16"
      height="16"
      style={{ position: 'absolute', top: '1px' }}
    />
  </div>
);

export default CopyIcon;
