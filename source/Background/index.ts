import 'emoji-log';
import { browser } from 'webextension-polyfill-ts';

import getPropOrUndefined from '../helpers/getPropOrUndefined';
import RequestHandler from './RequestHandler';

const requestHandler = RequestHandler();

browser.runtime.onMessage.addListener(async (request, _sender) => {
  if (getPropOrUndefined(request, 'target') === 'quill-extension') {
    return requestHandler(...request.args);
  }
});
