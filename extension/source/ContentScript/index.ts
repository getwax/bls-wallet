import { runtime } from 'webextension-polyfill';
import { PostMessageTransportServer } from '../common/postMessaging';

PostMessageTransportServer('quill-extension', (...args) =>
  runtime.sendMessage(undefined, {
    target: 'quill-extension',
    args,
  }),
);

const pageContentScriptTag = document.createElement('script');

pageContentScriptTag.src = runtime.getURL('js/pageContentScript.bundle.js');

document.body.appendChild(pageContentScriptTag);

export {};
