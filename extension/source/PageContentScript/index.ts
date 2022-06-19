import QuillEthereumProvider from './QuillEthereumProvider';

// TODO: Make pageContentScript just one file and do some renaming
// inPageScript.ts? ethereum.ts?

window.ethereum = new QuillEthereumProvider();
window.dispatchEvent(new Event('ethereum#initialized'));
