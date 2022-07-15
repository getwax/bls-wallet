import { NetworkConfig } from 'bls-wallet-clients';
import * as io from 'io-ts';

import blsNetworksConfigJson from '../build/blsNetworksConfig.json';
import assertType from './cells/assertType';
import optional from './types/optional';

const BlsNetworksConfig: io.Type<Record<string, NetworkConfig | undefined>> =
  io.record(
    io.string,
    optional(
      io.type({
        parameters: io.record(io.string, io.unknown),
        addresses: io.type({
          create2Deployer: io.string,
          precompileCostEstimator: io.string,
          verificationGateway: io.string,
          blsLibrary: io.string,
          blsExpander: io.string,
          utilities: io.string,
          testToken: io.string,
        }),
        auxiliary: io.type({
          chainid: io.number,
          domain: io.string,
          genesisBlock: io.number,
          deployedBy: io.string,
          version: io.string,
        }),
      }),
    ),
  );

assertType(blsNetworksConfigJson, BlsNetworksConfig);

const blsNetworksConfig: io.TypeOf<typeof BlsNetworksConfig> =
  blsNetworksConfigJson;

export default blsNetworksConfig;
