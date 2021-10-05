import { browser } from 'webextension-polyfill-ts';
import { PostMessageTransportServer } from '../common/postMessaging';
import RequestHandler from './RequestHandler';

const requestHandler = RequestHandler();

PostMessageTransportServer('quill-extension', requestHandler);

const pageContentScriptTag = document.createElement('script');

pageContentScriptTag.src = browser.runtime.getURL(
  'js/pageContentScript.bundle.js',
);

document.body.appendChild(pageContentScriptTag);

export {};
