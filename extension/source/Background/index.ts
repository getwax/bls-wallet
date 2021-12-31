import 'emoji-log';
import { browser } from 'webextension-polyfill-ts';
import { Aggregator /* , initBlsWalletSigner */ } from 'bls-wallet-clients';
import { ethers } from 'ethers';

import App from '../App';
import getPropOrUndefined from '../helpers/getPropOrUndefined';
import RequestHandler from './RequestHandler';

import { AGGREGATOR_URL /* , NETWORK_CONFIG */, CHAIN_RPC_URL } from '../env';

(async () => {
  const app = new App(
    new Aggregator(AGGREGATOR_URL),
    new ethers.providers.JsonRpcProvider(CHAIN_RPC_URL),
    browser.storage.local,
  );

  const requestHandler = RequestHandler(app);

  browser.runtime.onMessage.addListener(async (request, _sender) => {
    // TODO:
    // - send acks
    // - change target to quillEthereumProvider

    if (getPropOrUndefined(request, 'target') === 'quill-extension') {
      return requestHandler(...request.args);
    }
  });
})().catch(console.error);
