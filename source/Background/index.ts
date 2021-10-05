import 'emoji-log';
import { browser } from 'webextension-polyfill-ts';

console.log('loaded');

browser.runtime.onInstalled.addListener((): void => {
  console.emoji('🦄', 'extension installed');
});

browser.runtime.onMessage.addListener(async (request, sender) => {
  console.log(`Message from the content script:`, request, 'from', sender);

  if (request === 'confirm-demo') {
    browser.windows.create({
      url: browser.runtime.getURL('confirm.html'),
      type: 'popup',
      width: 359,
      height: 500,
    });
  }

  return 'placeholder response';
});

window.addEventListener('message', (...args) => {
  console.log('window message event captured by quill background script', {
    args,
  });
});
