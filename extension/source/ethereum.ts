import QuillEthereumProvider from './QuillEthereumProvider';

let ethereum: QuillEthereumProvider | undefined;

Object.defineProperty(window, 'ethereum', {
  get() {
    if (ethereum === undefined) {
      window.postMessage('ethereum-accessed', '*');
      ethereum = new QuillEthereumProvider();
    }

    return ethereum;
  },
});

window.dispatchEvent(new Event('ethereum#initialized'));
