import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

import '../styles.scss';

const LargeQuillHeading = (): React.ReactElement => (
  <div className="large-quill-heading">
    <img
      src={browser.runtime.getURL('assets/logo.svg')}
      alt="Quill"
      width="80"
      height="56"
    />
  </div>
);

export default LargeQuillHeading;
