import * as io from 'io-ts';

import configJson from '../config.json';
import { BuiltinChainName } from './background/networks';
import assertType from './cells/assertType';

const Config = io.type({
  defaultNetwork: BuiltinChainName,
  cryptoCompareApiKey: io.string,
  aggregatorUrls: io.record(io.string, io.string),
});

assertType(configJson, Config);

const config: io.TypeOf<typeof Config> = configJson;

export default config;
