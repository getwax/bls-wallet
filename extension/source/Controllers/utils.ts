// TODO: Move to helpers

import { DEFAULT_CHAIN_ID_HEX } from '../env';
import {
  BuiltinChainId,
  builtinChainIdToName,
  ProviderConfig,
  builtinProviderConfigs,
} from './constants';

// TODO: Use a better random source, and maybe more entropy
export const createRandomId = (): string => Math.random().toString(36).slice(2);

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

export const getBuiltinRPCURL = (builtinChainId: BuiltinChainId) => {
  const name = builtinChainIdToName(builtinChainId);
  return builtinProviderConfigs[name].rpcTarget;
};
