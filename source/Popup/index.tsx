import { initBlsWalletSigner } from 'bls-wallet-signer';
import { ethers } from 'ethers';
import * as React from 'react';
import ReactDOM from 'react-dom';
import AggregatorClient from '../AggregatorClient';
import App from './App';
import { AGGREGATOR_URL, CHAIN_ID, CHAIN_RPC_URL } from '../env';

import Popup from './Popup';

const appPromise = (async () =>
  new App(
    await initBlsWalletSigner({ chainId: CHAIN_ID }),
    new AggregatorClient(AGGREGATOR_URL),
    new ethers.providers.JsonRpcProvider(CHAIN_RPC_URL),
  ))();

ReactDOM.render(
  <Popup appPromise={appPromise} />,
  document.getElementById('popup-root'),
);
