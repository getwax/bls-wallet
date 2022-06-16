import { providers } from 'ethers';
import { QuillInPageProvider } from '../PageContentScript/InPageProvider';

declare global {
  interface Window {
    ethereum?:
      | QuillInPageProvider
      | (providers.ExternalProvider & { breakOnAssertionFailures: boolean })
      | { breakOnAssertionFailures: boolean };
  }
}
