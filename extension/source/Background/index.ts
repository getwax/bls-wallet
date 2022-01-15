import 'emoji-log';
import { runtime, storage } from 'webextension-polyfill';
import { Aggregator } from 'bls-wallet-clients';
import { initBlsWalletSigner } from 'bls-wallet-signer';
import { ethers } from 'ethers';

import App from '../App';
import getPropOrUndefined from '../helpers/getPropOrUndefined';
import RequestHandler from './RequestHandler';

import { AGGREGATOR_URL, NETWORK_CONFIG, CHAIN_RPC_URL } from '../env';

(async () => {
  const app = new App(
    await initBlsWalletSigner({ chainId: NETWORK_CONFIG.auxiliary.chainid }),
    new Aggregator(AGGREGATOR_URL),
    new ethers.providers.JsonRpcProvider(CHAIN_RPC_URL),
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
