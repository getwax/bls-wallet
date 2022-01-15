import { ReactElement } from 'react';
import { runtime } from 'webextension-polyfill';

const LargeQuillHeading = (): ReactElement => (
  <div className="large-quill-heading">
    <img
      src={runtime.getURL('assets/logo.svg')}
      alt="Quill"
      width="80"
      height="56"
    />
  </div>
);

export default LargeQuillHeading;
