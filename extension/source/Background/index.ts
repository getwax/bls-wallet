import 'emoji-log';
import { runtime, storage } from 'webextension-polyfill';
import { Aggregator } from 'bls-wallet-clients';
import { ethers } from 'ethers';

import App from '../App';
import getPropOrUndefined from '../helpers/getPropOrUndefined';
import RequestHandler from './RequestHandler';

import { AGGREGATOR_URL /* , NETWORK_CONFIG */ } from '../env';
import { getDefaultProviderConfig } from '../Controllers/utils';

(async () => {
  const providerConfig = getDefaultProviderConfig();
  const app = new App(
    new Aggregator(AGGREGATOR_URL),
    new ethers.providers.JsonRpcProvider(providerConfig.rpcTarget),
    storage.local,
  );

  const requestHandler = RequestHandler(app);

  runtime.onMessage.addListener(async (request, _sender) => {
    // TODO:
    // - send acks
    // - change target to quillEthereumProvider

    if (getPropOrUndefined(request, 'target') === 'quill-extension') {
      return requestHandler(...request.args);
    }
  });
})().catch(console.error);
