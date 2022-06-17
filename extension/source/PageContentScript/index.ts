import QuillProvider from './QuillProvider';

window.ethereum = new QuillProvider();
window.dispatchEvent(new Event('ethereum#initialized'));
