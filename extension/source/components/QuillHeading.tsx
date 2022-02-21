import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

const QuillHeading = (): React.ReactElement => (
  <div className="flex justify-center">
    <img
      src={browser.runtime.getURL('assets/logo-with-text-under.svg')}
      alt="Quill"
      width="85"
      height="60"
    />
  </div>
);

export default QuillHeading;
