import type { ReactElement } from 'react';
import { runtime } from 'webextension-polyfill';

import '../styles.scss';

const CopyIcon = (): ReactElement => (
  <div style={{ position: 'relative', width: '16px', height: '16px' }}>
    <img
      src={runtime.getURL('assets/copy.svg')}
      alt="copy"
      width="16"
      height="16"
      style={{ position: 'absolute', top: '1px' }}
    />
  </div>
);

export default CopyIcon;
