import assert from '../helpers/assert';
import QuillProvider from '../PageContentScript/QuillProvider';

const ethereumInitialziedEvent = 'ethereum#initialized';

function waitForWindowEthererum(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for window.ethereum'));
    }, 1000);

    function handleEthereumInitialized() {
      clearTimeout(timeout);

      window.removeEventListener(
        ethereumInitialziedEvent,
        handleEthereumInitialized,
      );

      resolve();
    }

    window.addEventListener(
      ethereumInitialziedEvent,
      handleEthereumInitialized,
    );
  });
}

export default async function getWindowQuillProvider(): Promise<QuillProvider> {
  if (!window.ethereum) {
    await waitForWindowEthererum();
  }
  if (!window.ethereum) {
    throw new Error('window.ethereum failed to initialize');
  }

  if ('isQuill' in window.ethereum) {
    assert(window.ethereum.isQuill);
    return window.ethereum;
  }

  throw new Error('window.ethereum is not Quill provider');
}
