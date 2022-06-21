import QuillEthereumProvider from './QuillEthereumProvider';

// TODO: MEGAFIX: Use a getter and memoize so that we don't connect anything
// unless the page actually uses window.ethereum.
window.ethereum = new QuillEthereumProvider();
window.dispatchEvent(new Event('ethereum#initialized'));
