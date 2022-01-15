import { Aggregator } from 'bls-wallet-clients';
import { initBlsWalletSigner } from 'bls-wallet-signer';
import { ethers } from 'ethers';
import * as React from 'react';
import ReactDOM from 'react-dom';
import { storage } from 'webextension-polyfill';

import App from '../App';
import { AGGREGATOR_URL, NETWORK_CONFIG, CHAIN_RPC_URL } from '../env';
import Popup from './Popup';

import './styles.scss';

const appPromise = (async () =>
  new App(
    await initBlsWalletSigner({ chainId: NETWORK_CONFIG.auxiliary.chainid }),
    new Aggregator(AGGREGATOR_URL),
    new ethers.providers.JsonRpcProvider(CHAIN_RPC_URL),
    storage.local,
  ))();

ReactDOM.render(
  <Popup appPromise={appPromise} />,
  document.getElementById('popup-root'),
);
