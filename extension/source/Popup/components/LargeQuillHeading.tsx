import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

const LargeQuillHeading = (): React.ReactElement => (
  <div className="large-quill-heading">
    <img
      src={browser.runtime.getURL('assets/logo-with-text.svg')}
      alt="Quill"
      width="100"
      height="35"
    />
  </div>
);

export default LargeQuillHeading;
