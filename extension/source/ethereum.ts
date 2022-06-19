import QuillEthereumProvider from './QuillEthereumProvider';

window.ethereum = new QuillEthereumProvider();
window.dispatchEvent(new Event('ethereum#initialized'));
