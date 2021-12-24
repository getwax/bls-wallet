import { Aggregator /* , initBlsWalletSigner */ } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import * as React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';

import App from '../App';
import { AGGREGATOR_URL /* , NETWORK_CONFIG */, CHAIN_RPC_URL } from '../env';
import Popup from './Popup';

import './styles.scss';

const appPromise = (async () =>
  new App(
    // TODO Is this still needed somewhere else?
    // await initBlsWalletSigner({ chainId: NETWORK_CONFIG.auxiliary.chainid }),
    new Aggregator(AGGREGATOR_URL),
    new ethers.providers.JsonRpcProvider(CHAIN_RPC_URL),
    browser.storage.local,
  ))();

ReactDOM.render(
  <Popup appPromise={appPromise} />,
  document.getElementById('popup-root'),
);
