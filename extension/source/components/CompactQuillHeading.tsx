import type { ReactElement } from 'react';
import { runtime } from 'webextension-polyfill';

const CompactQuillHeading = (): ReactElement => (
  <div className="compact-quill-heading">
    <img
      src={runtime.getURL('assets/logo.svg')}
      alt="Quill"
      width="58"
      height="40"
    />
  </div>
);

export default CompactQuillHeading;
