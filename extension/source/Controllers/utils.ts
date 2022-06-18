import { DEFAULT_CHAIN_ID_HEX } from '../env';
import assert from '../helpers/assert';
import {
  ChainId,
  chainIdToName,
  ProviderConfig,
  SUPPORTED_NETWORKS,
} from './constants';

// TODO: Use a better random source, and maybe more entropy
export const createRandomId = (): string => Math.random().toString(36).slice(2);

export const getUserLanguage = (): string => {
  const navLang = window.navigator.language || 'en-US';
  const preLang = navLang.split('-');
  return preLang[0] || 'en';
};

export const getDefaultProviderConfig = (): ProviderConfig => {
  const networkName = chainIdToName(DEFAULT_CHAIN_ID_HEX);
  const config = SUPPORTED_NETWORKS[networkName];

  assert(networkName !== undefined);
  assert(config !== undefined);

  return config;
};

export const getRPCURL = (chainId: ChainId): string => {
  const name = chainIdToName(chainId);
  return SUPPORTED_NETWORKS[name].rpcTarget;
};
