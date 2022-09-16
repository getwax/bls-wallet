import {
  MultiNetworkConfig as clientsMultiNetworkConfig,
  validateMultiConfig,
} from 'bls-wallet-clients';

import multiNetworkConfigJson from '../build/multiNetworkConfig.json';

export type MultiNetworkConfig = clientsMultiNetworkConfig;

export function loadMultiNetworkConfig(): MultiNetworkConfig {
  return validateMultiConfig(multiNetworkConfigJson);
}
