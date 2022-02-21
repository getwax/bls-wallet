import * as React from 'react';
import { runtime } from 'webextension-polyfill';

const QuillHeading = (): React.ReactElement => (
  <div className="flex justify-center">
    <img
      src={runtime.getURL('assets/logo-with-text-under.svg')}
      alt="Quill"
      width="85"
      height="60"
    />
  </div>
);

export default QuillHeading;
