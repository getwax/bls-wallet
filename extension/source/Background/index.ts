import 'emoji-log';
import { browser } from 'webextension-polyfill-ts';
import { initBlsWalletSigner } from 'bls-wallet-signer';
import { ethers } from 'ethers';

import App from '../App';
import getPropOrUndefined from '../helpers/getPropOrUndefined';
import RequestHandler from './RequestHandler';
import AggregatorClient from '../AggregatorClient';

import { AGGREGATOR_URL, CHAIN_ID, CHAIN_RPC_URL } from '../env';

(async () => {
  const app = new App(
    await initBlsWalletSigner({ chainId: CHAIN_ID }),
    new AggregatorClient(AGGREGATOR_URL),
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
