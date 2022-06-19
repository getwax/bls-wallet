import * as io from 'io-ts';

import { ProviderConfig } from '../constants';

export const NetworkProperties = io.intersection([
  io.record(io.string, io.unknown),
  io.type({
    // undefined means we have not checked yet. (true or false means property is set)
    EIPS: io.record(io.string, io.union([io.boolean, io.undefined])),
  }),
]);

/**
 * Custom network properties
 * @example isEIP1559Compatible: true etc.
 */
export type NetworkProperties = io.TypeOf<typeof NetworkProperties>;

export const NetworkConfig = io.type({
  providerConfig: ProviderConfig,
});

export type NetworkConfig = io.TypeOf<typeof NetworkConfig>;
