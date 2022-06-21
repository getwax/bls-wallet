import QuillEthereumProvider from './QuillEthereumProvider';

let ethereum: QuillEthereumProvider | undefined;

Object.defineProperty(window, 'ethereum', {
  get() {
    if (ethereum === undefined) {
      // TODO: MEGAFIX: Now that we're creating lazily, we should also tell the
      // content script when this happens so that it actually doesn't connect
      // anything unless this happens.
      ethereum = new QuillEthereumProvider();
    }

    return ethereum;
  },
});

window.dispatchEvent(new Event('ethereum#initialized'));
