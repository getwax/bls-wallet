import { providers } from 'ethers';
import { Browser } from 'webextension-polyfill';
import { QuillInPageProvider } from '../PageContentScript/InPageProvider';

declare global {
  interface Window {
    ethereum?: QuillInPageProvider | providers.ExternalProvider;
    Browser?: Browser;
  }
}
