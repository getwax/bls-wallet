import { FunctionComponent } from 'react';
import { runtime } from 'webextension-polyfill';

const LogoFooter: FunctionComponent = () => (
  <div
    className="h-16 flex place-items-center"
    style={{
      background: `center no-repeat url(${runtime.getURL(
        'assets/logo-with-text-white.svg',
      )})`,
    }}
  />
);

export default LogoFooter;
