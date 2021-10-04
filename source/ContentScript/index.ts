import { browser } from 'webextension-polyfill-ts';

console.log('helloworld from content script');

window.addEventListener('message', (...args) => {
  console.log('window message event captured by quill content script', {
    args,
  });
});

const pageContentScriptTag = document.createElement('script');

pageContentScriptTag.src = browser.runtime.getURL(
  'js/pageContentScript.bundle.js',
);

document.body.appendChild(pageContentScriptTag);

export {};
