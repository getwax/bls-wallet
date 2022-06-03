import assert from '../helpers/assert';

import { QuillInPageProvider } from '../PageContentScript/InPageProvider';

export default function getWindowEthereum() {
  const windowAny = window as any;

  if (windowAny.ethereum?.isQuill) {
    return Promise.resolve(windowAny.ethereum);
  }

  return new Promise<QuillInPageProvider>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for window.ethereum'));
    }, 1000);

    function handleEthereumInitialized() {
      clearTimeout(timeout);

      window.removeEventListener(
        'ethereum#initialized',
        handleEthereumInitialized,
      );

      const { ethereum } = windowAny;
      assert(ethereum?.isQuill === true);

      resolve(ethereum);
    }

    window.addEventListener('ethereum#initialized', handleEthereumInitialized);
  });
}
