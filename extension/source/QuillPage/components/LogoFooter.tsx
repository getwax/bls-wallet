import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

const LogoFooter: React.FunctionComponent = () => (
  <div
    className="logo-footer"
    style={{
      background: `center no-repeat url(${browser.runtime.getURL(
        'assets/logo-with-text-white.svg',
      )})`,
    }}
  />
);

export default LogoFooter;
