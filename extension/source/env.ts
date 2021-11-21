import { requireEnv, requireIntEnv } from './helpers/envTools';

export const CHAIN_ID = requireIntEnv(process.env.CHAIN_ID);
export const PROVIDER_URL = requireEnv(process.env.PROVIDER_URL);
// export const ETHERSCAN_KEY = requireEnv(process.env.ETHERSCAN_KEY);

export const PRIVATE_KEY_STORAGE_KEY = requireEnv(
  process.env.PRIVATE_KEY_STORAGE_KEY,
);

export const AGGREGATOR_URL = requireEnv(process.env.AGGREGATOR_URL);
export const CHAIN_RPC_URL = requireEnv(process.env.CHAIN_RPC_URL);
export const CREATE_TX_URL = requireEnv(process.env.CREATE_TX_URL);

export const VERIFICATION_GATEWAY_ADDRESS = requireEnv(
  process.env.VERIFICATION_GATEWAY_ADDRESS,
);
