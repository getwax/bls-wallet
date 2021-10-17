import { browser } from 'webextension-polyfill-ts';
import { PostMessageTransportServer } from '../common/postMessaging';

PostMessageTransportServer('quill-extension', (...args) =>
  browser.runtime.sendMessage(undefined, {
    target: 'quill-extension',
    args,
  }),
);

const pageContentScriptTag = document.createElement('script');

pageContentScriptTag.src = browser.runtime.getURL(
  'js/pageContentScript.bundle.js',
);

document.body.appendChild(pageContentScriptTag);

export {};
