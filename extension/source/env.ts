import { validateConfig } from 'bls-wallet-clients';
import { assertTypeEcho } from './cells/assertType';
import { ChainId } from './Controllers/constants';
import { requireEnv } from './helpers/envTools';
import toHex from './helpers/toHex';

// export const ETHERSCAN_KEY = requireEnv(process.env.ETHERSCAN_KEY);
export const PRIVATE_KEY_STORAGE_KEY = requireEnv(
  process.env.PRIVATE_KEY_STORAGE_KEY,
);

export const AGGREGATOR_URL = requireEnv(process.env.AGGREGATOR_URL);

export const DEFAULT_CHAIN_ID_HEX = assertTypeEcho(
  toHex(parseInt(requireEnv(process.env.DEFAULT_CHAIN_ID))),
  ChainId,
);

export const CREATE_TX_URL = requireEnv(process.env.CREATE_TX_URL);

export const NETWORK_CONFIG = validateConfig(
  JSON.parse(requireEnv(process.env.NETWORK_CONFIG)),
);
