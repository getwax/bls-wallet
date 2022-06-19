import QuillProvider from './QuillProvider';

// TODO: Make pageContentScript just one file and do some renaming
// inPageScript.ts? ethereum.ts?

window.ethereum = new QuillProvider();
window.dispatchEvent(new Event('ethereum#initialized'));
