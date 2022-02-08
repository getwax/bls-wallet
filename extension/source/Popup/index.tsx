import { Aggregator } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import ReactDOM from 'react-dom';
import { storage } from 'webextension-polyfill';

import App from '../App';
import { AGGREGATOR_URL, CHAIN_RPC_URL } from '../env';
import Popup from './Popup';

import './styles.scss';

const appPromise = (async () =>
  new App(
    new Aggregator(AGGREGATOR_URL),
    new ethers.providers.JsonRpcProvider(CHAIN_RPC_URL),
    storage.local,
  ))();

ReactDOM.render(
  <Popup appPromise={appPromise} />,
  document.getElementById('popup-root'),
);
