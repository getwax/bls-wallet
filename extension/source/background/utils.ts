// TODO: Move to helpers

import { encode as encode58 } from 'bs58check';

import { DEFAULT_CHAIN_ID_HEX } from '../env';
import {
  builtinChainIdToName,
  ProviderConfig,
  builtinProviderConfigs,
} from './networks';

export const RandomId = (): string =>
  encode58(crypto.getRandomValues(new Uint8Array(16)));

export const getUserLanguage = (): string => {
  const navLang = window.navigator.language || 'en-US';
  const preLang = navLang.split('-');
  return preLang[0] || 'en';
};

export const getDefaultProviderConfig = (): ProviderConfig => {
  const networkName = builtinChainIdToName(DEFAULT_CHAIN_ID_HEX);
  const config = builtinProviderConfigs[networkName];

  return config;
};
