import * as io from 'io-ts';

import configJson from '../config.json';
import { ProviderConfig } from './background/ProviderConfig';
import assertType from './cells/assertType';
import optional from './types/optional';

const Config = io.type({
  defaultNetwork: io.string,
  cryptoCompareApiKey: io.string,
  builtinNetworks: io.record(io.string, optional(ProviderConfig)),
});

assertType(configJson, Config);

const config: io.TypeOf<typeof Config> = configJson;

export default config;
