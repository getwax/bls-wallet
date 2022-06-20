import type { providers } from 'ethers';
import type { Browser } from 'webextension-polyfill';
import type QuillEthereumProvider from '../QuillEthereumProvider';
import type { QuillContextValue } from '../QuillPage/QuillContext';

declare global {
  interface Window {
    ethereum?: QuillEthereumProvider | providers.ExternalProvider;
    debug?: {
      Browser?: Browser;
      quill?: QuillContextValue;
    };
    isQuillExtensionPage?: true;
  }
}
