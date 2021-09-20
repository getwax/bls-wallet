import { initBlsWalletSigner } from 'bls-wallet-signer';
import { ethers } from 'ethers';
import * as React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';

import AggregatorClient from '../AggregatorClient';
import App from './App';
import { AGGREGATOR_URL, CHAIN_ID, CHAIN_RPC_URL } from '../env';
import Popup from './Popup';
import FigmaTesting from './FigmaTesting';

import './styles.scss';

const appPromise = (async () =>
  new App(
    await initBlsWalletSigner({ chainId: CHAIN_ID }),
    new AggregatorClient(AGGREGATOR_URL),
    new ethers.providers.JsonRpcProvider(CHAIN_RPC_URL),
    browser.storage.local,
  ))();

if (true) {
  ReactDOM.render(
    <Popup appPromise={appPromise} />,
    document.getElementById('popup-root'),
  );
} else {
  ReactDOM.render(<FigmaTesting />, document.getElementById('popup-root'));
}
