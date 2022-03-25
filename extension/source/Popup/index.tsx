import { Aggregator } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import ReactDOM from 'react-dom';
import { storage } from 'webextension-polyfill';

import App from '../App';
import { getDefaultProviderConfig } from '../Controllers/utils';
import { AGGREGATOR_URL } from '../env';
import Popup from './Popup';

import './styles.scss';

const appPromise = (async () => {
  const providerConfig = getDefaultProviderConfig();
  return new App(
    new Aggregator(AGGREGATOR_URL),
    new ethers.providers.JsonRpcProvider(providerConfig.rpcTarget),
    storage.local,
  );
})();

ReactDOM.render(
  <Popup appPromise={appPromise} />,
  document.getElementById('popup-root'),
);
