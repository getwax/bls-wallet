import type { providers } from 'ethers';
import type QuillProvider from '../PageContentScript/QuillProvider';

declare global {
  interface Window {
    ethereum?:
      | QuillProvider
      | (providers.ExternalProvider & { breakOnAssertionFailures: boolean })
      | { breakOnAssertionFailures: boolean };
  }
}
