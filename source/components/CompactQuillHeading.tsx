import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

const CompactQuillHeading = (): React.ReactElement => (
  <div className="compact-quill-heading">
    <img
      src={browser.runtime.getURL('assets/logo.svg')}
      alt="Quill"
      width="58"
      height="40"
    />
  </div>
);

export default CompactQuillHeading;
