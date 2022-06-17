import { validateConfig } from 'bls-wallet-clients';
import { requireEnv } from './helpers/envTools';
import toHex from './helpers/toHex';

export const PRIVATE_KEY_STORAGE_KEY = requireEnv(
  process.env.PRIVATE_KEY_STORAGE_KEY,
);

export const AGGREGATOR_URL = requireEnv(process.env.AGGREGATOR_URL);
export const DEFAULT_CHAIN_ID_HEX = toHex(
  parseInt(requireEnv(process.env.DEFAULT_CHAIN_ID)),
);

export const NETWORK_CONFIG = validateConfig(
  JSON.parse(requireEnv(process.env.NETWORK_CONFIG)),
);

export const CRYPTO_COMPARE_API_KEY = requireEnv(
  process.env.CRYPTO_COMPARE_API_KEY,
);
