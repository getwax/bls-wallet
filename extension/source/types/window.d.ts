import type { providers } from 'ethers';
import type QuillEthereumProvider from '../ethereumvider';

declare global {
  interface Window {
    ethereum?:
      | QuillEthereumProvider
      | (providers.ExternalProvider & { breakOnAssertionFailures: boolean })
      | { breakOnAssertionFailures: boolean };
  }
}
