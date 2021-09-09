import { requireEnv, requireIntEnv } from './helpers/envTools';

export const CHAIN_ID = requireIntEnv(process.env.CHAIN_ID);
export const WALLET_STORAGE_KEY = requireEnv(process.env.WALLET_STORAGE_KEY);
export const AGGREGATOR_URL = requireEnv(process.env.AGGREGATOR_URL);
export const CHAIN_RPC_URL = requireEnv(process.env.CHAIN_RPC_URL);

export const VERIFICATION_GATEWAY_ADDRESS = requireEnv(
  process.env.VERIFICATION_GATEWAY_ADDRESS
);
